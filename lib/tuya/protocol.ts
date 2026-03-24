'use strict';

import * as crypto from 'crypto';
import { PREFIX, SUFFIX, HEADER_SIZE, FOOTER_SIZE } from './constants';
import { encryptPayload, decryptPayload, md5, encryptEcb } from './cipher';
import { CommandType } from './types';
import type { ProtocolVersion, TuyaMessage, TuyaPayload } from './types';

let _seqNo = 0;

/** Get next sequence number */
function nextSeqNo(): number {
  _seqNo = (_seqNo + 1) & 0xffffffff;
  return _seqNo;
}

/** Calculate CRC32 for protocol framing */
function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Encode a Tuya command into a framed buffer ready to send.
 */
export function encodeMessage(
  command: CommandType,
  payload: TuyaPayload | null,
  localKey: Buffer,
  protocolVersion: ProtocolVersion,
  sessionKey?: Buffer,
): Buffer {
  const seqNo = nextSeqNo();
  let payloadBuf: Buffer;

  if (payload === null) {
    payloadBuf = Buffer.alloc(0);
  } else {
    payloadBuf = Buffer.from(JSON.stringify(payload), 'utf8');
  }

  let encrypted: Buffer;

  if (protocolVersion === '3.4' || protocolVersion === '3.5') {
    encrypted = encryptPayload(payloadBuf, localKey, protocolVersion, sessionKey);
  } else if (protocolVersion === '3.3' || protocolVersion === '3.2') {
    encrypted = encryptPayload(payloadBuf, localKey, protocolVersion);
    // Protocol 3.3 requires version header for CONTROL commands
    if (command === CommandType.CONTROL || command === CommandType.CONTROL_NEW) {
      const versionBuf = Buffer.alloc(15);
      versionBuf.write(protocolVersion, 0, 'ascii');
      const hashBuf = md5(encrypted);
      hashBuf.copy(versionBuf, 3, 0, 12);
      encrypted = Buffer.concat([versionBuf, encrypted]);
    }
  } else {
    // Protocol 3.1
    const base64 = encryptPayload(payloadBuf, localKey, '3.1').toString('base64');
    if (command === CommandType.CONTROL) {
      const hashStr = md5(`data=${base64}||lpv=${protocolVersion}||${localKey.toString('utf8')}`).toString('hex').substring(8, 24);
      encrypted = Buffer.from(`${protocolVersion}${hashStr}${base64}`, 'utf8');
    } else {
      encrypted = Buffer.from(base64, 'utf8');
    }
  }

  // Frame: prefix(4) + seqno(4) + cmd(4) + length(4) + payload + crc(4) + suffix(4)
  const payloadLen = encrypted.length + FOOTER_SIZE;
  const totalLen = HEADER_SIZE + encrypted.length + FOOTER_SIZE;

  const buffer = Buffer.alloc(totalLen);
  let offset = 0;

  PREFIX.copy(buffer, offset); offset += 4;
  buffer.writeUInt32BE(seqNo, offset); offset += 4;
  buffer.writeUInt32BE(command, offset); offset += 4;
  buffer.writeUInt32BE(payloadLen, offset); offset += 4;
  encrypted.copy(buffer, offset); offset += encrypted.length;

  const crcValue = crc32(buffer.subarray(0, offset));
  buffer.writeUInt32BE(crcValue, offset); offset += 4;
  SUFFIX.copy(buffer, offset);

  return buffer;
}

/**
 * Parse a received buffer into one or more TuyaMessage objects.
 * Returns parsed messages and any remaining bytes.
 */
export function parseMessages(data: Buffer): { messages: TuyaMessage[]; remaining: Buffer } {
  const messages: TuyaMessage[] = [];
  let offset = 0;

  while (offset < data.length) {
    // Find prefix
    const prefixIndex = data.indexOf(PREFIX, offset);
    if (prefixIndex === -1 || prefixIndex + HEADER_SIZE > data.length) {
      break;
    }

    offset = prefixIndex;

    const seqNo = data.readUInt32BE(offset + 4);
    const commandType = data.readUInt32BE(offset + 8) as CommandType;
    const payloadSize = data.readUInt32BE(offset + 12);

    const totalMessageLen = HEADER_SIZE + payloadSize;
    if (offset + totalMessageLen > data.length) {
      break; // Incomplete message
    }

    // Extract return code and payload
    const returnCode = data.readUInt32BE(offset + HEADER_SIZE);
    const payloadStart = offset + HEADER_SIZE;
    const payloadEnd = offset + HEADER_SIZE + payloadSize - FOOTER_SIZE;

    let payload: Buffer;
    // Return code check: if first 4 bytes of payload area look like a return code
    if (returnCode === 0 && payloadEnd - payloadStart > 4) {
      payload = data.subarray(payloadStart + 4, payloadEnd);
    } else {
      payload = data.subarray(payloadStart, payloadEnd);
    }

    const crc = data.readUInt32BE(offset + HEADER_SIZE + payloadSize - FOOTER_SIZE);

    messages.push({
      seqNo,
      commandType,
      payloadSize,
      returnCode,
      payload,
      crc,
    });

    offset += totalMessageLen;
  }

  const remaining = offset < data.length ? data.subarray(offset) : Buffer.alloc(0);
  return { messages, remaining };
}

/**
 * Decode a message payload to JSON.
 */
export function decodePayload(
  message: TuyaMessage,
  localKey: Buffer,
  protocolVersion: ProtocolVersion,
  sessionKey?: Buffer,
): TuyaPayload | null {
  if (message.payload.length === 0) {
    return null;
  }

  try {
    // Try direct JSON parse first (heartbeat ack, etc.)
    const directStr = message.payload.toString('utf8');
    if (directStr.startsWith('{')) {
      return JSON.parse(directStr);
    }
  } catch {
    // Not direct JSON, try decryption
  }

  try {
    const decrypted = decryptPayload(message.payload, localKey, protocolVersion, sessionKey);
    const str = decrypted.toString('utf8');
    // Strip trailing nulls
    const cleaned = str.replace(/\0+$/, '');
    if (cleaned.length > 0 && cleaned.startsWith('{')) {
      return JSON.parse(cleaned);
    }
  } catch {
    // Decryption or parse failed
  }

  return null;
}

/**
 * Build session key negotiation start message for protocol 3.4+.
 */
export function buildSessionKeyStart(localRandom: Buffer, localKey: Buffer): Buffer {
  const seqNo = nextSeqNo();
  const encrypted = encryptEcb(localRandom, localKey);

  const payloadLen = encrypted.length + FOOTER_SIZE;
  const totalLen = HEADER_SIZE + encrypted.length + FOOTER_SIZE;

  const buffer = Buffer.alloc(totalLen);
  let offset = 0;

  PREFIX.copy(buffer, offset); offset += 4;
  buffer.writeUInt32BE(seqNo, offset); offset += 4;
  buffer.writeUInt32BE(CommandType.SESS_KEY_NEG_START, offset); offset += 4;
  buffer.writeUInt32BE(payloadLen, offset); offset += 4;
  encrypted.copy(buffer, offset); offset += encrypted.length;

  const crcValue = crc32(buffer.subarray(0, offset));
  buffer.writeUInt32BE(crcValue, offset); offset += 4;
  SUFFIX.copy(buffer, offset);

  return buffer;
}

/**
 * Build session key negotiation finish message for protocol 3.4+.
 */
export function buildSessionKeyFinish(localRandom: Buffer, remoteRandom: Buffer, localKey: Buffer): Buffer {
  const seqNo = nextSeqNo();
  const hmac = crypto.createHmac('sha256', localKey).update(remoteRandom).digest();

  const payloadLen = hmac.length + FOOTER_SIZE;
  const totalLen = HEADER_SIZE + hmac.length + FOOTER_SIZE;

  const buffer = Buffer.alloc(totalLen);
  let offset = 0;

  PREFIX.copy(buffer, offset); offset += 4;
  buffer.writeUInt32BE(seqNo, offset); offset += 4;
  buffer.writeUInt32BE(CommandType.SESS_KEY_NEG_FINISH, offset); offset += 4;
  buffer.writeUInt32BE(payloadLen, offset); offset += 4;
  hmac.copy(buffer, offset); offset += hmac.length;

  const crcValue = crc32(buffer.subarray(0, offset));
  buffer.writeUInt32BE(crcValue, offset); offset += 4;
  SUFFIX.copy(buffer, offset);

  return buffer;
}
