'use strict';

import * as crypto from 'crypto';
import type { ProtocolVersion } from './types';

/** AES-ECB encrypt (protocol 3.1–3.3) */
export function encryptEcb(data: Buffer, key: Buffer): Buffer {
  const cipher = crypto.createCipheriv('aes-128-ecb', key, null);
  cipher.setAutoPadding(true);
  return Buffer.concat([cipher.update(data), cipher.final()]);
}

/** AES-ECB decrypt (protocol 3.1–3.3) */
export function decryptEcb(data: Buffer, key: Buffer): Buffer {
  const decipher = crypto.createDecipheriv('aes-128-ecb', key, null);
  decipher.setAutoPadding(true);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

/** AES-GCM encrypt (protocol 3.4+) */
export function encryptGcm(data: Buffer, key: Buffer, iv: Buffer, aad?: Buffer): { encrypted: Buffer; tag: Buffer } {
  const cipher = crypto.createCipheriv('aes-128-gcm', key, iv);
  if (aad) cipher.setAAD(aad);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { encrypted, tag };
}

/** AES-GCM decrypt (protocol 3.4+) */
export function decryptGcm(data: Buffer, key: Buffer, iv: Buffer, tag: Buffer, aad?: Buffer): Buffer {
  const decipher = crypto.createDecipheriv('aes-128-gcm', key, iv);
  decipher.setAuthTag(tag);
  if (aad) decipher.setAAD(aad);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

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

/**
 * Encrypt payload for the given protocol version.
 * Returns the encrypted data ready for framing.
 */
export function encryptPayload(
  payload: Buffer,
  localKey: Buffer,
  protocolVersion: ProtocolVersion,
  sessionKey?: Buffer,
): Buffer {
  const key = sessionKey || localKey;

  if (protocolVersion === '3.4' || protocolVersion === '3.5') {
    const iv = randomBytes(12);
    const { encrypted, tag } = encryptGcm(payload, key, iv);
    return Buffer.concat([iv, encrypted, tag]);
  }

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

  if (protocolVersion === '3.4' || protocolVersion === '3.5') {
    if (data.length < 28) {
      throw new Error('GCM payload too short');
    }
    const iv = data.subarray(0, 12);
    const tag = data.subarray(data.length - 16);
    const encrypted = data.subarray(12, data.length - 16);
    return decryptGcm(encrypted, key, iv, tag);
  }

  // Protocol 3.1–3.3
  // Check if data starts with the version string
  if (data.length > 15 && data.subarray(0, 3).toString() === '3.') {
    // Strip version header + hash
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
