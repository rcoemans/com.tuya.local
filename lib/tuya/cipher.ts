'use strict';

import * as crypto from 'crypto';
import type { ProtocolVersion } from './types';

// ── AES-ECB (protocol 3.1–3.4) ──────────────────────────────────────

/** AES-ECB encrypt with auto-padding (protocol 3.1–3.3) */
export function encryptEcb(data: Buffer, key: Buffer): Buffer {
  const cipher = crypto.createCipheriv('aes-128-ecb', key, null);
  cipher.setAutoPadding(true);
  return Buffer.concat([cipher.update(data), cipher.final()]);
}

/** AES-ECB decrypt with auto-padding (protocol 3.1–3.3) */
export function decryptEcb(data: Buffer, key: Buffer): Buffer {
  const decipher = crypto.createDecipheriv('aes-128-ecb', key, null);
  decipher.setAutoPadding(true);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

/** AES-ECB encrypt WITHOUT auto-padding (protocol 3.4 — caller must PKCS7-pad) */
export function encryptEcbNoPad(data: Buffer, key: Buffer): Buffer {
  const cipher = crypto.createCipheriv('aes-128-ecb', key, null);
  cipher.setAutoPadding(false);
  const encrypted = cipher.update(data);
  cipher.final(); // flush (no data — already padded)
  return encrypted;
}

/** AES-ECB decrypt WITHOUT auto-padding (protocol 3.4 — caller strips PKCS7) */
export function decryptEcbNoPad(data: Buffer, key: Buffer): Buffer {
  const decipher = crypto.createDecipheriv('aes-128-ecb', key, null);
  decipher.setAutoPadding(false);
  const result = decipher.update(data);
  decipher.final();
  return result;
}

// ── AES-GCM (protocol 3.5) ──────────────────────────────────────────

/** AES-GCM encrypt (protocol 3.5) */
export function encryptGcm(data: Buffer, key: Buffer, iv: Buffer, aad?: Buffer): { encrypted: Buffer; tag: Buffer } {
  const cipher = crypto.createCipheriv('aes-128-gcm', key, iv);
  if (aad) cipher.setAAD(aad);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { encrypted, tag };
}

/** AES-GCM decrypt (protocol 3.5) */
export function decryptGcm(data: Buffer, key: Buffer, iv: Buffer, tag: Buffer, aad?: Buffer): Buffer {
  const decipher = crypto.createDecipheriv('aes-128-gcm', key, iv);
  decipher.setAuthTag(tag);
  if (aad) decipher.setAAD(aad);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

// ── Helpers ──────────────────────────────────────────────────────────

/** MD5 hash helper */
export function md5(data: string | Buffer): Buffer {
  return crypto.createHash('md5').update(data).digest();
}

/** HMAC-SHA256 helper */
export function hmacSha256(data: Buffer, key: Buffer): Buffer {
  return crypto.createHmac('sha256', key).update(data).digest();
}

/** Generate random bytes */
export function randomBytes(length: number): Buffer {
  return crypto.randomBytes(length);
}

/** PKCS#7 pad to 16-byte boundary */
export function pkcs7Pad(data: Buffer): Buffer {
  const padding = 0x10 - (data.length & 0xf);
  const buf = Buffer.alloc(data.length + padding, padding);
  data.copy(buf);
  return buf;
}

/** Remove PKCS#7 padding */
export function pkcs7Strip(data: Buffer): Buffer {
  if (data.length === 0) return data;
  const padByte = data[data.length - 1];
  if (padByte > 0 && padByte <= 16) {
    return data.subarray(0, data.length - padByte);
  }
  return data;
}

// ── High-level encrypt / decrypt per protocol version ────────────────

/**
 * Encrypt payload for the given protocol version.
 * Protocol 3.1–3.3: AES-128-ECB with auto-padding.
 * Protocol 3.4: AES-128-ECB with manual PKCS7 padding, no auto-padding.
 * Protocol 3.5: AES-128-GCM (iv + ciphertext + tag).
 */
export function encryptPayload(
  payload: Buffer,
  localKey: Buffer,
  protocolVersion: ProtocolVersion,
  sessionKey?: Buffer,
): Buffer {
  const key = sessionKey || localKey;

  if (protocolVersion === '3.5') {
    // 3.5 GCM is handled entirely in protocol.ts (needs AAD from header)
    // Fallback: raw GCM without AAD
    const iv = randomBytes(12);
    const { encrypted, tag } = encryptGcm(payload, key, iv);
    return Buffer.concat([iv, encrypted, tag]);
  }

  if (protocolVersion === '3.4') {
    // 3.4: ECB with manual PKCS7 padding
    const padded = pkcs7Pad(payload);
    return encryptEcbNoPad(padded, key);
  }

  // 3.1–3.3: ECB with auto-padding
  return encryptEcb(payload, key);
}

/**
 * Decrypt payload for the given protocol version.
 */
export function decryptPayload(
  data: Buffer,
  localKey: Buffer,
  protocolVersion: ProtocolVersion,
  sessionKey?: Buffer,
): Buffer {
  const key = sessionKey || localKey;

  if (protocolVersion === '3.5') {
    // 3.5 GCM payloads from the device: iv(12) + ciphertext + tag(16)
    if (data.length < 28) {
      throw new Error('GCM payload too short');
    }
    const iv = data.subarray(0, 12);
    const tag = data.subarray(data.length - 16);
    const encrypted = data.subarray(12, data.length - 16);
    return decryptGcm(encrypted, key, iv, tag);
  }

  if (protocolVersion === '3.4') {
    // 3.4: ECB with manual PKCS7 stripping
    const decrypted = decryptEcbNoPad(data, key);
    return pkcs7Strip(decrypted);
  }

  // Protocol 3.1–3.3
  // Check if data starts with the version string header
  if (data.length > 15 && data.subarray(0, 3).toString() === '3.') {
    // Strip version header (3 bytes version + 12 bytes zeros/hash)
    const stripped = data.subarray(15);
    return decryptEcb(stripped, key);
  }

  return decryptEcb(data, key);
}

/**
 * Negotiate session key for protocol 3.4+.
 * Returns the derived session key from the local random + remote random.
 */
export function deriveSessionKey(localRandom: Buffer, remoteRandom: Buffer, localKey: Buffer): Buffer {
  const sessionKey = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) {
    sessionKey[i] = localRandom[i] ^ remoteRandom[i];
  }
  return encryptEcb(sessionKey, localKey);
}
