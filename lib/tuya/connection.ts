'use strict';

import * as net from 'net';
import { EventEmitter } from 'events';
import {
  TUYA_PORT,
  HEARTBEAT_INTERVAL,
  HEARTBEAT_TIMEOUT,
  CONNECT_TIMEOUT,
  COMMAND_TIMEOUT,
} from './constants';
import { randomBytes, deriveSessionKey, decryptEcbNoPad, hmacSha256 } from './cipher';
import {
  encodeMessage,
  parseMessages,
  decodePayload,
  buildSessionKeyStart,
  buildSessionKeyFinish,
} from './protocol';
import { getBackoffDelay } from '../util/retries';
import { CommandType } from './types';
import type {
  ProtocolVersion,
  TuyaDeviceConfig,
  DpsState,
  TuyaPayload,
  TuyaMessage,
} from './types';

type LogFunction = (...args: unknown[]) => void;

interface TuyaConnectionOptions extends TuyaDeviceConfig {
  log: LogFunction;
  error: LogFunction;
}

export class TuyaConnection extends EventEmitter {
  private _host: string;
  private _deviceId: string;
  private _localKey: Buffer;
  private _protocolVersion: ProtocolVersion;
  private _nodeId: string | null;
  private _pollInterval: number;
  private _log: LogFunction;
  private _error: LogFunction;

  private _socket: net.Socket | null = null;
  private _connected = false;
  private _connecting = false;
  private _destroyed = false;
  private _sessionKey: Buffer | undefined;
  private _receiveBuffer: Buffer = Buffer.alloc(0) as Buffer;

  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private _heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  private _pollTimer: ReturnType<typeof setInterval> | null = null;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _reconnectAttempt = 0;

  private _commandQueue: Array<{
    resolve: (value: TuyaPayload | null) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }> = [];

  constructor(options: TuyaConnectionOptions) {
    super();
    this._host = options.host;
    this._deviceId = options.deviceId;
    this._localKey = Buffer.from(options.localKey, 'utf8');
    this._protocolVersion = options.protocolVersion === 'auto' ? '3.3' : options.protocolVersion;
    this._nodeId = options.nodeId || null;
    this._pollInterval = (options.pollInterval || 30) * 1000;
    this._log = options.log;
    this._error = options.error;
  }

  get connected(): boolean {
    return this._connected;
  }

  /** Connect to the Tuya device */
  async connect(): Promise<void> {
    if (this._destroyed || this._connecting) return;
    this._connecting = true;

    try {
      await this._createSocket();
      this._log('Socket created, negotiating session (protocol %s)...', this._protocolVersion);
      await this._negotiateSession();
      this._connected = true;
      this._connecting = false;
      this._reconnectAttempt = 0;
      this._startHeartbeat();
      this._startPolling();
      this._log('Emitting connected, sending initial status query...');
      this.emit('connected');

      // Initial status query
      const dps = await this.status();
      this._log('Status query returned: %s', dps ? JSON.stringify(dps) : 'null');
      if (dps) {
        this.emit('dps', dps);
      }
    } catch (err) {
      this._connecting = false;
      this._cleanup();
      this._error('Connection failed:', err);
      this._scheduleReconnect();
      this.emit('disconnected', err instanceof Error ? err : new Error(String(err)));
    }
  }

  /** Send a DP_QUERY and return current datapoint values */
  async status(): Promise<DpsState | null> {
    let payload: TuyaPayload;
    let cmd: CommandType;

    if (this._isNewProtocol()) {
      // Protocol 3.4/3.5: DP_QUERY_NEW with empty payload
      cmd = CommandType.DP_QUERY_NEW;
      payload = {};
    } else {
      // Protocol 3.1–3.3: DP_QUERY with full device identifiers
      cmd = CommandType.DP_QUERY;
      payload = {
        gwId: this._deviceId,
        devId: this._deviceId,
        uid: this._nodeId || this._deviceId,
        t: Math.round(Date.now() / 1000).toString(),
        dps: {},
      };
    }

    this._log('[DIAG] status() sending cmd=%d payload=%s', cmd, JSON.stringify(payload));
    const result = await this._sendCommand(cmd, payload);
    this._log('[DIAG] status() result=%s', result ? JSON.stringify(result) : 'null');
    return result?.dps || null;
  }

  /** Set datapoint values on the device */
  async setDps(dps: DpsState): Promise<void> {
    if (this._isNewProtocol()) {
      // Protocol 3.4/3.5: CONTROL_NEW with {protocol:5, t:<int>, data:{dps:{...}}}
      // Fire-and-forget — device responds with async STATUS push, not a CONTROL echo
      const payload = {
        protocol: 5,
        t: Math.floor(Date.now() / 1000),
        data: { dps },
      } as unknown as TuyaPayload;
      const msg = encodeMessage(CommandType.CONTROL_NEW, payload, this._localKey, this._protocolVersion, this._sessionKey);
      this._write(msg);
    } else {
      // Protocol 3.1–3.3: CONTROL with standard payload, wait for response
      const payload: TuyaPayload = {
        devId: this._deviceId,
        gwId: this._deviceId,
        uid: this._nodeId || this._deviceId,
        t: Math.floor(Date.now() / 1000).toString(),
        dps,
      };
      await this._sendCommand(CommandType.CONTROL, payload);
    }
  }

  /** Request async DP refresh */
  async refreshDps(dpIds: number[]): Promise<void> {
    const payload: TuyaPayload = {
      gwId: this._deviceId,
      devId: this._deviceId,
      uid: this._nodeId || this._deviceId,
      t: Math.round(Date.now() / 1000).toString(),
      dpId: dpIds,
    };

    await this._sendCommand(CommandType.UPDATEDPS, payload);
  }

  /** Reconnect with updated settings */
  async reconnect(options?: Partial<TuyaDeviceConfig>): Promise<void> {
    if (options?.host) this._host = options.host;
    if (options?.localKey) this._localKey = Buffer.from(options.localKey, 'utf8');
    if (options?.protocolVersion) {
      this._protocolVersion = options.protocolVersion === 'auto' ? '3.3' : options.protocolVersion;
    }
    if (options?.pollInterval) this._pollInterval = options.pollInterval * 1000;

    this._cleanup();
    this._reconnectAttempt = 0;
    await this.connect();
  }

  /** Destroy the connection permanently */
  async destroy(): Promise<void> {
    this._destroyed = true;
    this._cleanup();
  }

  private _isNewProtocol(): boolean {
    return this._protocolVersion === '3.4' || this._protocolVersion === '3.5';
  }

  private _createSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this._socket) {
          this._socket.destroy();
          this._socket = null;
        }
        reject(new Error(`Connection timeout to ${this._host}:${TUYA_PORT}`));
      }, CONNECT_TIMEOUT);

      this._socket = new net.Socket();

      this._socket.on('data', (data: Buffer) => {
        this._onData(data);
      });

      this._socket.on('close', () => {
        clearTimeout(timeout);
        if (this._connected) {
          this._connected = false;
          this._cleanup();
          this._log('Socket closed');
          this._scheduleReconnect();
          this.emit('disconnected', new Error('Socket closed'));
        }
      });

      this._socket.on('error', (err: Error) => {
        clearTimeout(timeout);
        this._error('Socket error:', err.message);
        if (!this._connected && !this._connecting) return;
        this._connected = false;
        this._cleanup();
        this._scheduleReconnect();
        this.emit('disconnected', err);
      });

      this._socket.connect(TUYA_PORT, this._host, () => {
        clearTimeout(timeout);
        this._log(`Connected to ${this._host}:${TUYA_PORT}`);
        resolve();
      });
    });
  }

  private async _negotiateSession(): Promise<void> {
    if (!this._isNewProtocol()) {
      this._sessionKey = undefined;
      return;
    }

    this._log('Negotiating session key for protocol %s (key length=%d, key hex=%s)',
      this._protocolVersion, this._localKey.length, this._localKey.toString('hex'));

    const localRandom = randomBytes(16);
    const startMsg = buildSessionKeyStart(localRandom, this._localKey);
    this._write(startMsg);

    // Wait for SESS_KEY_NEG_RES
    const response = await this._waitForCommand(CommandType.SESS_KEY_NEG_RES, 5000);
    if (!response || response.payload.length < 48) {
      this._log('[DIAG] SESS_KEY_NEG_RES payload length: %d', response?.payload.length ?? 0);
      throw new Error('Invalid session key negotiation response');
    }

    // Decrypt the entire RESP payload (ECB, no auto-padding)
    const decrypted = decryptEcbNoPad(response.payload, this._localKey);
    const remoteRandom = decrypted.subarray(0, 16);
    const remoteHmac = decrypted.subarray(16, 48);

    // Verify HMAC: device sends HMAC(localKey, localRandom) for authentication
    const expectedHmac = hmacSha256(localRandom, this._localKey);
    if (!remoteHmac.equals(expectedHmac)) {
      this._log('[DIAG] HMAC mismatch in session negotiation (wrong local key?)');
      throw new Error('Session key HMAC verification failed');
    }

    this._log('[DIAG] Session nonce local=%s remote=%s',
      localRandom.toString('hex').substring(0, 8),
      remoteRandom.toString('hex').substring(0, 8));

    this._sessionKey = deriveSessionKey(localRandom, remoteRandom, this._localKey);

    const finishMsg = buildSessionKeyFinish(localRandom, remoteRandom, this._localKey);
    this._write(finishMsg);

    // Small delay to allow session key to be accepted
    await new Promise((resolve) => setTimeout(resolve, 100));
    this._log('Session key established');
  }

  private _sendCommand(command: CommandType, payload: TuyaPayload): Promise<TuyaPayload | null> {
    return new Promise((resolve, reject) => {
      if (!this._socket || !this._connected) {
        reject(new Error('Not connected'));
        return;
      }

      const timeout = setTimeout(() => {
        const idx = this._commandQueue.findIndex((q) => q.timeout === timeout);
        if (idx >= 0) this._commandQueue.splice(idx, 1);
        reject(new Error(`Command ${command} timed out`));
      }, COMMAND_TIMEOUT);

      this._commandQueue.push({ resolve, reject, timeout });

      const msg = encodeMessage(command, payload, this._localKey, this._protocolVersion, this._sessionKey);
      this._write(msg);
    });
  }

  private _waitForCommand(commandType: CommandType, timeoutMs: number): Promise<TuyaMessage | null> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.removeListener('_raw_message', handler);
        resolve(null);
      }, timeoutMs);

      const handler = (msg: TuyaMessage) => {
        if (msg.commandType === commandType) {
          clearTimeout(timeout);
          this.removeListener('_raw_message', handler);
          resolve(msg);
        }
      };

      this.on('_raw_message', handler);
    });
  }

  private _onData(data: Buffer): void {
    this._log('[DIAG RX] %d bytes: %s', data.length, data.subarray(0, Math.min(64, data.length)).toString('hex'));
    this._receiveBuffer = Buffer.from(Buffer.concat([this._receiveBuffer, data]));

    const { messages, remaining } = parseMessages(this._receiveBuffer, this._protocolVersion);
    this._receiveBuffer = Buffer.from(remaining);

    for (const msg of messages) {
      this.emit('_raw_message', msg);
      this._handleMessage(msg);
    }
  }

  private _handleMessage(msg: TuyaMessage): void {
    this._log('[DIAG MSG] cmd=%d seq=%d retCode=%d payloadLen=%d payload=%s',
      msg.commandType, msg.seqNo, msg.returnCode, msg.payload.length,
      msg.payload.subarray(0, Math.min(48, msg.payload.length)).toString('hex'));
    switch (msg.commandType) {
      case CommandType.HEART_BEAT: {
        this._onHeartbeatResponse();
        break;
      }

      case CommandType.STATUS:
      case CommandType.DP_QUERY:
      case CommandType.DP_QUERY_NEW:
      case CommandType.CONTROL:
      case CommandType.CONTROL_NEW:
      case CommandType.UPDATEDPS: {
        const decoded = decodePayload(msg, this._localKey, this._protocolVersion, this._sessionKey);

        // Resolve pending command
        if (this._commandQueue.length > 0) {
          const pending = this._commandQueue.shift()!;
          clearTimeout(pending.timeout);
          pending.resolve(decoded);
        }

        // Emit DPS updates
        if (decoded?.dps) {
          this.emit('dps', decoded.dps);
        }
        break;
      }

      default:
        break;
    }
  }

  private _startHeartbeat(): void {
    this._stopHeartbeat();
    this._heartbeatTimer = setInterval(() => {
      this._sendHeartbeat();
    }, HEARTBEAT_INTERVAL);
  }

  private _stopHeartbeat(): void {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
    if (this._heartbeatTimeout) {
      clearTimeout(this._heartbeatTimeout);
      this._heartbeatTimeout = null;
    }
  }

  private _sendHeartbeat(): void {
    if (!this._socket || !this._connected) return;

    const msg = encodeMessage(CommandType.HEART_BEAT, null, this._localKey, this._protocolVersion, this._sessionKey);
    this._write(msg);

    this._heartbeatTimeout = setTimeout(() => {
      this._log('Heartbeat timeout');
      if (this._socket) {
        this._socket.destroy();
      }
    }, HEARTBEAT_TIMEOUT);
  }

  private _onHeartbeatResponse(): void {
    if (this._heartbeatTimeout) {
      clearTimeout(this._heartbeatTimeout);
      this._heartbeatTimeout = null;
    }
  }

  private _startPolling(): void {
    this._stopPolling();
    this._pollTimer = setInterval(async () => {
      try {
        const dps = await this.status();
        if (dps) {
          this.emit('dps', dps);
        }
      } catch (err) {
        this._error('Poll failed:', err);
      }
    }, this._pollInterval);
  }

  private _stopPolling(): void {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  private _scheduleReconnect(): void {
    if (this._destroyed || this._reconnectTimer) return;

    const delay = getBackoffDelay(this._reconnectAttempt);
    this._reconnectAttempt++;
    this._log(`Reconnecting in ${delay}ms (attempt ${this._reconnectAttempt})`);

    this._reconnectTimer = setTimeout(async () => {
      this._reconnectTimer = null;
      await this.connect();
    }, delay);
  }

  private _cleanup(): void {
    this._stopHeartbeat();
    this._stopPolling();

    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }

    // Reject all pending commands
    for (const pending of this._commandQueue) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Connection closed'));
    }
    this._commandQueue = [];

    if (this._socket) {
      this._socket.removeAllListeners();
      this._socket.destroy();
      this._socket = null;
    }

    this._connected = false;
    this._sessionKey = undefined;
    this._receiveBuffer = Buffer.alloc(0);
  }

  private _write(data: Buffer): void {
    if (this._socket && !this._socket.destroyed) {
      this._log('[DIAG TX] %d bytes: %s', data.length, data.subarray(0, Math.min(64, data.length)).toString('hex'));
      this._socket.write(data);
    }
  }
}
