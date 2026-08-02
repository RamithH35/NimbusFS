import crypto from 'crypto';

/**
 * Computes the SHA-256 hash of a buffer.
 * 
 * @param {Buffer} buffer - The file buffer in plaintext
 * @returns {string} - The SHA-256 hex digest
 */
export function computeHash(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('Input must be a Buffer');
  }
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export default computeHash;
