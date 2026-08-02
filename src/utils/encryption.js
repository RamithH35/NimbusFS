import crypto from 'crypto';
import { ENCRYPTION_KEY } from '../config/env.js';

// Resolve key buffer and validate length at module load
if (!ENCRYPTION_KEY) {
  throw new Error('CRITICAL ERROR: ENCRYPTION_KEY environment variable is not defined.');
}

const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex');

if (keyBuffer.length !== 32) {
  throw new Error(`CRITICAL ERROR: ENCRYPTION_KEY must represent exactly 32 bytes (64 hex chars). Loaded length is ${keyBuffer.length} bytes.`);
}

/**
 * Encrypts a buffer using AES-256-GCM.
 * 
 * @param {Buffer} buffer - Plaintext buffer
 * @returns {{encryptedBuffer: Buffer, iv: string, authTag: string}}
 */
export function encrypt(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('Input must be a Buffer');
  }

  // Generate a random 12-byte IV
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);

  const encryptedBuffer = Buffer.concat([
    cipher.update(buffer),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  return {
    encryptedBuffer,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

/**
 * Decrypts a buffer using AES-256-GCM.
 * 
 * @param {Buffer} encryptedBuffer - Encrypted buffer
 * @param {string} ivHex - Hex encoded IV
 * @param {string} authTagHex - Hex encoded Auth Tag
 * @returns {Buffer} - Decrypted plaintext buffer
 */
export function decrypt(encryptedBuffer, ivHex, authTagHex) {
  if (!Buffer.isBuffer(encryptedBuffer)) {
    throw new TypeError('encryptedBuffer must be a Buffer');
  }
  if (!ivHex || !authTagHex) {
    throw new Error('IV and Auth Tag are required for AES-256-GCM decryption');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
  decipher.setAuthTag(authTag);

  const decryptedBuffer = Buffer.concat([
    decipher.update(encryptedBuffer),
    decipher.final()
  ]);

  return decryptedBuffer;
}
