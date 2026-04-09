'use strict';

import * as crypto from 'crypto';
import { PREFIX, SUFFIX, HEADER_SIZE, FOOTER_SIZE } from './constants';
import {
  encryptPayload,
  decryptPayload,
  md5,
  encryptEcb,
  hmacSha256,
  encryptGcm,
  randomBytes as randomBytesHelper,
  pkcs7Pad,
  encryptEcbNoPad,
} from './cipher';
import { CommandType } from './types';
import type { ProtocolVersion, TuyaMessage, TuyaPayload } from './types';

/** 6699 prefix for protocol 3.5 */
const PREFIX_6699 = Buffer.from('00006699', 'hex');
const SUFFIX_6699 = Buffer.from('00009966', 'hex');

let _seqNo = 0;

/** Get next sequence number */
function nextSeqNo(): number {
  _seqNo = (_seqNo + 1) & 0xffffffff;
  return _seqNo;
}

/** Calculate CRC32 for protocol framing (3.1–3.3) */
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

/** Commands that should NOT get the version header prepended */
function skipVersionHeader(command: CommandType): boolean {
  return (
    command === CommandType.DP_QUERY ||
    command === CommandType.DP_QUERY_NEW ||
    command === CommandType.UPDATEDPS ||
    command === CommandType.HEART_BEAT ||
    command === CommandType.SESS_KEY_NEG_START ||
    command === CommandType.SESS_KEY_NEG_FINISH
  );
}

// ── Encode per protocol version ──────────────────────────────────────

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
  if (protocolVersion === '3.5') {
    return _encode35(command, payload, localKey, sessionKey);
  }
  if (protocolVersion === '3.4') {
    return _encode34(command, payload, localKey, sessionKey);
  }
  if (protocolVersion === '3.3' || protocolVersion === '3.2') {
    return _encode33(command, payload, localKey, protocolVersion);
  }
  // 3.1
  return _encode31(command, payload, localKey, protocolVersion);
}

/**
 * Protocol 3.1: Base64-ECB encrypted payloads.
 * Only CONTROL gets a version+MD5 header prefix.
 * Non-CONTROL (DP_QUERY etc.) sends base64 plaintext of the encrypted data.
 * Reference: tuyapi _encodePre34 with version !== '3.3' && !== '3.2'
 */
function _encode31(
  command: CommandType,
  payload: TuyaPayload | null,
  localKey: Buffer,
  protocolVersion: ProtocolVersion,
): Buffer {
  const seqNo = nextSeqNo();
  const payloadBuf = payload === null ? Buffer.alloc(0) : Buffer.from(JSON.stringify(payload), 'utf8');

  let encoded: Buffer;

  if (command === CommandType.CONTROL) {
    // Encrypt, base64, then prepend version + MD5 hash
    const encrypted = encryptPayload(payloadBuf, localKey, '3.1');
    const base64 = encrypted.toString('base64');
    const hashStr = md5(`data=${base64}||lpv=${protocolVersion}||${localKey.toString('utf8')}`)
      .toString('hex')
      .substring(8, 24);
    encoded = Buffer.from(`${protocolVersion}${hashStr}${base64}`, 'utf8');
  } else {
    // Non-CONTROL: encrypt to base64 plaintext
    const encrypted = encryptPayload(payloadBuf, localKey, '3.1');
    encoded = Buffer.from(encrypted.toString('base64'), 'utf8');
  }

  return _frame55aa(seqNo, command, encoded, (buf) => {
    const c = crc32(buf);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(c, 0);
    return crcBuf;
  });
}

/**
 * Protocol 3.2 / 3.3: Always ECB-encrypted. Version header (3.x + 12 zero bytes)
 * prepended only for commands that are NOT in the skip list (DP_QUERY, UPDATEDPS, HEART_BEAT).
 * Reference: tuyapi _encodePre34 with version === '3.3'
 */
function _encode33(
  command: CommandType,
  payload: TuyaPayload | null,
  localKey: Buffer,
  protocolVersion: ProtocolVersion,
): Buffer {
  const seqNo = nextSeqNo();
  const payloadBuf = payload === null ? Buffer.alloc(0) : Buffer.from(JSON.stringify(payload), 'utf8');

  let encrypted = encryptPayload(payloadBuf, localKey, protocolVersion);

  // Add version header for non-skipped commands
  if (!skipVersionHeader(command)) {
    const versionBuf = Buffer.alloc(15); // "3.3" + 12 zero bytes
    versionBuf.write(protocolVersion, 0, 'ascii');
    encrypted = Buffer.concat([versionBuf, encrypted]);
  }

  return _frame55aa(seqNo, command, encrypted, (buf) => {
    const c = crc32(buf);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(c, 0);
    return crcBuf;
  });
}

/**
 * Protocol 3.4: ECB with manual PKCS7 padding + HMAC-SHA256 integrity (32 bytes).
 * Version header (3.4 + 12 zero bytes) prepended for non-skipped commands BEFORE padding+encryption.
 * Frame: 55AA, length = payload + 0x24 (HMAC 32 + suffix 4), HMAC replaces CRC.
 * Reference: tuyapi _encode34
 */
function _encode34(
  command: CommandType,
  payload: TuyaPayload | null,
  localKey: Buffer,
  sessionKey?: Buffer,
): Buffer {
  const seqNo = nextSeqNo();
  let payloadBuf = payload === null ? Buffer.alloc(0) : Buffer.from(JSON.stringify(payload), 'utf8');

  // Add version header for non-skipped commands
  if (!skipVersionHeader(command)) {
    const versionBuf = Buffer.alloc(15);
    versionBuf.write('3.4', 0, 'ascii');
    payloadBuf = Buffer.concat([versionBuf, payloadBuf]);
  }

  // PKCS7-pad, then encrypt with ECB (no auto-padding)
  const key = sessionKey || localKey;
  const padded = pkcs7Pad(payloadBuf);
  const encrypted = encryptEcbNoPad(padded, key);

  // Build frame with HMAC instead of CRC
  // Total: header(16) + encrypted + hmac(32) + suffix(4) = encrypted + 52
  const buffer = Buffer.alloc(encrypted.length + 52);

  buffer.writeUInt32BE(0x000055aa, 0);        // prefix
  buffer.writeUInt32BE(seqNo, 4);              // sequence
  buffer.writeUInt32BE(command, 8);            // command
  buffer.writeUInt32BE(encrypted.length + 0x24, 12); // length (payload + hmac(32) + suffix(4))
  encrypted.copy(buffer, 16);                  // payload

  // HMAC over header + payload
  const hmac = hmacSha256(buffer.subarray(0, encrypted.length + 16), key);
  hmac.copy(buffer, encrypted.length + 16);    // hmac (32 bytes)

  buffer.writeUInt32BE(0x0000aa55, encrypted.length + 48); // suffix

  return buffer;
}

/**
 * Protocol 3.5: 6699-prefixed frame with GCM encryption + AAD.
 * Version header (3.5 + 12 zero bytes) prepended for non-skipped commands.
 * Frame: 6699(4) + unknown(2) + seq(4) + cmd(4) + len(4) + iv(12) + encrypted + tag(16) + suffix(4)
 * AAD = bytes 4..17 of the header (unknown + seq + cmd + len)
 * Reference: tuyapi _encode35
 */
function _encode35(
  command: CommandType,
  payload: TuyaPayload | null,
  localKey: Buffer,
  sessionKey?: Buffer,
): Buffer {
  const seqNo = nextSeqNo();
  let payloadBuf = payload === null ? Buffer.alloc(0) : Buffer.from(JSON.stringify(payload), 'utf8');

  // Add version header for non-skipped commands
  if (!skipVersionHeader(command)) {
    const versionBuf = Buffer.alloc(15);
    versionBuf.write('3.5', 0, 'ascii');
    payloadBuf = Buffer.concat([versionBuf, payloadBuf]);
  }

  // Build header: prefix(4) + unknown(2) + seq(4) + cmd(4) + len(4) = 18 bytes
  const header = Buffer.alloc(18);
  header.writeUInt32BE(0x00006699, 0);
  header.writeUInt16BE(0x0000, 4);             // unknown
  header.writeUInt32BE(seqNo, 6);
  header.writeUInt32BE(command, 10);
  header.writeUInt32BE(payloadBuf.length + 28, 14); // 12 (iv) + tag(16) = 28 overhead + actual encrypted len = same as payload len + 28

  // AAD = header bytes 4..17 (14 bytes)
  const aad = header.subarray(4, 18);

  // Encrypt with GCM
  const key = sessionKey || localKey;
  const iv = Buffer.from((Date.now() * 10).toString().slice(0, 12));
  const { encrypted, tag } = encryptGcm(payloadBuf, key, iv, aad);

  // Result: header + iv + encrypted + tag + suffix(6699 suffix = 0x00009966)
  return Buffer.concat([header, iv, encrypted, tag, SUFFIX_6699]);
}

/** Helper: frame a 55AA packet with given integrity function (CRC32 or HMAC) */
function _frame55aa(
  seqNo: number,
  command: CommandType,
  payload: Buffer,
  integrityFn: (buf: Buffer) => Buffer,
): Buffer {
  const payloadLen = payload.length + 8; // + crc(4) + suffix(4)
  const totalLen = HEADER_SIZE + payload.length + 8;

  const buffer = Buffer.alloc(totalLen);

  PREFIX.copy(buffer, 0);
  buffer.writeUInt32BE(seqNo, 4);
  buffer.writeUInt32BE(command, 8);
  buffer.writeUInt32BE(payloadLen, 12);
  payload.copy(buffer, 16);

  const integrity = integrityFn(buffer.subarray(0, 16 + payload.length));
  integrity.copy(buffer, 16 + payload.length);
  SUFFIX.copy(buffer, 16 + payload.length + 4);

  return buffer;
}

// ── Parse received data ──────────────────────────────────────────────

/**
 * Parse a received buffer into one or more TuyaMessage objects.
 * Supports both 55AA (3.1–3.4) and 6699 (3.5) frames.
 */
export function parseMessages(data: Buffer, protocolVersion?: ProtocolVersion): { messages: TuyaMessage[]; remaining: Buffer } {
  const messages: TuyaMessage[] = [];
  let offset = 0;

  // For 3.4, the "footer" is HMAC(32) + suffix(4) = 0x24 bytes
  // For 3.1–3.3, the "footer" is CRC(4) + suffix(4) = 0x08 bytes
  const is34 = protocolVersion === '3.4';
  const footerSize34 = 0x24; // 36

  while (offset < data.length) {
    // Try 55AA prefix first
    const idx55 = data.indexOf(PREFIX, offset);
    const idx66 = data.indexOf(PREFIX_6699, offset);

    let prefixIndex: number;
    let is6699 = false;

    if (idx55 === -1 && idx66 === -1) break;
    if (idx55 === -1) { prefixIndex = idx66; is6699 = true; }
    else if (idx66 === -1) { prefixIndex = idx55; }
    else if (idx66 < idx55) { prefixIndex = idx66; is6699 = true; }
    else { prefixIndex = idx55; }

    offset = prefixIndex;

    if (is6699) {
      // 6699 frame: prefix(4) + unknown(2) + seq(4) + cmd(4) + len(4) = 18 header
      if (offset + 18 > data.length) break;

      const seqNo = data.readUInt32BE(offset + 6);
      const commandType = data.readUInt32BE(offset + 10) as CommandType;
      const payloadSize = data.readUInt32BE(offset + 14);

      // Total = 18 (header) + payloadSize + 4 (suffix 9966)
      const totalMessageLen = 18 + payloadSize + 4;
      if (offset + totalMessageLen > data.length) break;

      const payload = data.subarray(offset + 18, offset + 18 + payloadSize);

      messages.push({
        seqNo,
        commandType,
        payloadSize,
        returnCode: 0,
        payload,
        crc: 0,
      });

      offset += totalMessageLen;
    } else {
      // 55AA frame
      if (offset + HEADER_SIZE > data.length) break;

      const seqNo = data.readUInt32BE(offset + 4);
      const commandType = data.readUInt32BE(offset + 8) as CommandType;
      const payloadSize = data.readUInt32BE(offset + 12);

      const totalMessageLen = HEADER_SIZE + payloadSize;
      if (offset + totalMessageLen > data.length) break;

      const returnCode = data.readUInt32BE(offset + HEADER_SIZE);
      const payloadStart = offset + HEADER_SIZE;

      // For 3.4: ALL 55AA messages (including session negotiation) use HMAC footer (0x24 = 36 bytes)
      // For 3.1–3.3: CRC footer (0x08 = 8 bytes)
      const tailSize = is34 ? footerSize34 : FOOTER_SIZE;
      const payloadEnd = offset + HEADER_SIZE + payloadSize - tailSize;

      let payload: Buffer;
      if ((returnCode & 0xffffff00) === 0 && payloadEnd - payloadStart > 4) {
        // Return code is 0 (success) — skip the 4-byte return code
        payload = data.subarray(payloadStart + 4, payloadEnd);
      } else {
        // Non-zero return code or error — include it as part of payload
        payload = data.subarray(payloadStart, payloadEnd);
      }

      const crc = is34 ? 0 : data.readUInt32BE(offset + HEADER_SIZE + payloadSize - FOOTER_SIZE);

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

  // Try direct JSON parse first (heartbeat ack, some 3.1 responses)
  try {
    const directStr = message.payload.toString('utf8');
    if (directStr.startsWith('{')) {
      return JSON.parse(directStr);
    }
  } catch {
    // Not direct JSON, try decryption
  }

  try {
    let decrypted = decryptPayload(message.payload, localKey, protocolVersion, sessionKey);
    let str = decrypted.toString('utf8');

    // Strip trailing nulls
    str = str.replace(/\0+$/, '');

    // Strip version header if present after decryption (3.4/3.5)
    if (str.length > 15 && str.substring(0, 2) === '3.') {
      str = str.substring(15);
    }

    if (str.length > 0 && str.startsWith('{')) {
      const parsed = JSON.parse(str);

      // 3.4/3.5 wrap DPS in { protocol, t, data: { dps: {...} } }
      if (parsed.data && typeof parsed.data === 'object' && parsed.data.dps) {
        const unwrapped = parsed.data as TuyaPayload;
        unwrapped.t = parsed.t;
        return unwrapped;
      }

      return parsed;
    }
    // Decrypted but not JSON
    console.error('[DIAG] decodePayload: decrypted but no JSON, str=%s', str.substring(0, 80));
  } catch (err) {
    console.error('[DIAG] decodePayload failed: cmd=%d payloadLen=%d err=%s',
      message.commandType, message.payload.length, err instanceof Error ? err.message : String(err));
  }

  return null;
}

// ── Session key negotiation (3.4+) ──────────────────────────────────

/**
 * Build session key negotiation start message for protocol 3.4+.
 * Payload = localRandom (16 bytes, already block-aligned — no PKCS7 padding).
 * Encrypted with ECB, framed with HMAC-SHA256.
 * Reference: tinytuya _encode_message with pad=False for session commands.
 */
export function buildSessionKeyStart(localRandom: Buffer, localKey: Buffer): Buffer {
  // NO padding — 16 bytes is already a multiple of AES block size
  const encrypted = encryptEcbNoPad(localRandom, localKey);

  const seqNo = nextSeqNo();
  const buffer = Buffer.alloc(encrypted.length + 52);

  buffer.writeUInt32BE(0x000055aa, 0);
  buffer.writeUInt32BE(seqNo, 4);
  buffer.writeUInt32BE(CommandType.SESS_KEY_NEG_START, 8);
  buffer.writeUInt32BE(encrypted.length + 0x24, 12);
  encrypted.copy(buffer, 16);

  const hmac = hmacSha256(buffer.subarray(0, encrypted.length + 16), localKey);
  hmac.copy(buffer, encrypted.length + 16);
  buffer.writeUInt32BE(0x0000aa55, encrypted.length + 48);

  return buffer;
}

/**
 * Build session key negotiation finish message for protocol 3.4+.
 * Payload = HMAC-SHA256(localKey, remoteRandom) — 32 bytes, already block-aligned.
 * Encrypted with ECB (no padding), framed with HMAC-SHA256.
 * Reference: tinytuya _negotiate_session_key_generate_step_3.
 */
export function buildSessionKeyFinish(_localRandom: Buffer, remoteRandom: Buffer, localKey: Buffer): Buffer {
  // The payload for FINISH is HMAC(localKey, remoteRandom) = 32 bytes
  const payload = crypto.createHmac('sha256', localKey).update(remoteRandom).digest();

  // NO padding — 32 bytes is already a multiple of AES block size
  const encrypted = encryptEcbNoPad(payload, localKey);

  const seqNo = nextSeqNo();
  const buffer = Buffer.alloc(encrypted.length + 52);

  buffer.writeUInt32BE(0x000055aa, 0);
  buffer.writeUInt32BE(seqNo, 4);
  buffer.writeUInt32BE(CommandType.SESS_KEY_NEG_FINISH, 8);
  buffer.writeUInt32BE(encrypted.length + 0x24, 12);
  encrypted.copy(buffer, 16);

  const hmac = hmacSha256(buffer.subarray(0, encrypted.length + 16), localKey);
  hmac.copy(buffer, encrypted.length + 16);
  buffer.writeUInt32BE(0x0000aa55, encrypted.length + 48);

  return buffer;
}
