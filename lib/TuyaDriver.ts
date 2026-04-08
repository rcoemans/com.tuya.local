'use strict';

import Homey from 'homey';
import { TuyaConnection } from './tuya/connection';
import { inferProfile } from './tuya/profiles';
import type { ProtocolVersion, DpsState } from './tuya/types';
import type { AppLogger } from './AppLogger';

/**
 * Base Tuya driver class shared by all drivers.
 * Handles the custom pairing flow.
 */
class TuyaDriver extends Homey.Driver {

  private get _appLogger(): AppLogger | undefined {
    return (this.homey.app as any).appLogger;
  }

  private _appLog(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    this._appLogger?.[level]('Driver', message);
  }

  async onInit(): Promise<void> {
    this.log(`${this.constructor.name} has been initialized`);
    this._appLog(`${this.constructor.name} initialized`);
  }

  async onPairListDevices(): Promise<Record<string, unknown>[]> {
    // Manual pairing — return empty list, the user enters credentials in custom views
    return [];
  }

  async onPair(session: Homey.Driver.PairSession): Promise<void> {
    let deviceData: {
      host: string;
      deviceId: string;
      localKey: string;
      protocolVersion: ProtocolVersion;
      nodeId: string;
      name: string;
    } = {
      host: '',
      deviceId: '',
      localKey: '',
      protocolVersion: '3.3',
      nodeId: '',
      name: '',
    };

    let discoveredDps: DpsState = {};

    session.setHandler('get_device_data', async () => {
      return deviceData;
    });

    session.setHandler('set_device_data', async (data: typeof deviceData) => {
      deviceData = data;
    });

    session.setHandler('validate_connection', async () => {
      this.log('validate_connection: host=%s deviceId=%s', deviceData.host, deviceData.deviceId);
      this._appLog(`Validating connection to ${deviceData.host} (${deviceData.deviceId})`);

      if (!deviceData.host || !deviceData.deviceId || !deviceData.localKey) {
        return { success: false, error: 'Missing required credentials (host, device ID, or local key)' };
      }

      const connection = new TuyaConnection({
        host: deviceData.host,
        deviceId: deviceData.deviceId,
        localKey: deviceData.localKey,
        protocolVersion: deviceData.protocolVersion,
        nodeId: deviceData.nodeId || null,
        log: this.log.bind(this),
        error: this.error.bind(this),
      });

      const PAIR_VALIDATE_TIMEOUT = 12_000;
      try {
        const dps = await Promise.race([
          new Promise<DpsState>((resolve, reject) => {
            connection.once('dps', (d: DpsState) => resolve(d));
            connection.once('disconnected', (err: Error) => reject(err));
            connection.connect().catch(reject);
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Connection timed out — device may be unreachable')), PAIR_VALIDATE_TIMEOUT),
          ),
        ]);

        discoveredDps = dps || {};
        this._appLog(`Connection validated: ${Object.keys(discoveredDps).length} DPs discovered`);
        return { success: true, dps: discoveredDps };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this._appLog(`Connection validation failed: ${msg}`, 'error');
        return {
          success: false,
          error: msg,
        };
      } finally {
        try { await connection.destroy(); } catch { /* ignore */ }
      }
    });

    session.setHandler('get_discovered_dps', async () => {
      return discoveredDps;
    });

    session.setHandler('list_devices', async () => {
      const profile = inferProfile(discoveredDps);
      const deviceId = deviceData.nodeId
        ? `${deviceData.deviceId}:${deviceData.nodeId}`
        : deviceData.deviceId;

      return [{
        name: deviceData.name || `Tuya ${profile?.homeyClass || 'Device'}`,
        data: {
          id: deviceId,
        },
        settings: {
          host: deviceData.host,
          device_id: deviceData.deviceId,
          local_key: deviceData.localKey,
          protocol_version: deviceData.protocolVersion,
          node_id: deviceData.nodeId || '',
          poll_interval: 30,
        },
        store: {
          host: deviceData.host,
          device_id: deviceData.deviceId,
          protocol_version: deviceData.protocolVersion,
          node_id: deviceData.nodeId || null,
          profile: profile?.id || this._getDefaultProfile(),
          mapping: this._buildDefaultMapping(discoveredDps),
        },
      }];
    });
  }

  async onRepair(session: Homey.Driver.PairSession, device: Homey.Device): Promise<void> {
    session.setHandler('get_device_settings', async () => {
      return device.getSettings();
    });

    session.setHandler('update_credentials', async (data: { host: string; localKey: string; protocolVersion: ProtocolVersion }) => {
      await device.setSettings({
        host: data.host,
        local_key: data.localKey,
        protocol_version: data.protocolVersion,
      });
      return { success: true };
    });
  }

  /** Get the default profile ID for this driver type */
  protected _getDefaultProfile(): string {
    return 'socket_basic';
  }

  /** Build a simple DP mapping from discovered DPs */
  protected _buildDefaultMapping(_dps: DpsState): Record<string, string> {
    return {};
  }

}

export default TuyaDriver;
