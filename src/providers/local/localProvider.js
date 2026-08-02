/* eslint-disable security/detect-non-literal-fs-filename */
import fs from 'fs';
import path from 'path';
import StorageProvider from '../StorageProvider.js';

const UPLOADS_DIR = path.resolve('uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export class LocalProvider extends StorageProvider {
  constructor() {
    super('local');
  }

  /**
   * Upload file to local storage
   * @param {Buffer} buffer - File buffer
   * @param {string} originalName - Original filename
   * @param {string} mimeType - File MIME type
   * @returns {Promise<{storedName: string, url: string, size: number}>}
   */
  async upload(buffer, originalName, mimeType) {
    const ext = path.extname(originalName);
    const storedName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}${ext}`;
    const filePath = path.join(UPLOADS_DIR, storedName);

    await fs.promises.writeFile(filePath, buffer);
    const url = `/uploads/${storedName}`;

    return {
      storedName,
      url,
      size: buffer.length,
    };
  }

  /**
   * Download file from local storage
   * @param {string} storedName 
   * @returns {Promise<fs.ReadStream>} - Readable stream
   */
  async download(storedName) {
    const filePath = path.join(UPLOADS_DIR, storedName);
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found on storage provider');
    }
    return fs.createReadStream(filePath);
  }

  /**
   * Delete file from local storage
   * @param {string} storedName 
   * @returns {Promise<void>}
   */
  async delete(storedName) {
    const filePath = path.join(UPLOADS_DIR, storedName);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    } else {
      throw new Error('File not found on storage provider for deletion');
    }
  }

  /**
   * Health Check
   * @returns {Promise<{healthy: boolean, latency: number}>}
   */
  async healthCheck() {
    const start = Date.now();
    try {
      if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      }
      fs.accessSync(UPLOADS_DIR, fs.constants.W_OK);
      return {
        healthy: true,
        latency: Date.now() - start,
      };
    } catch {
      return {
        healthy: false,
        latency: Date.now() - start,
      };
    }
  }
}

export const localProvider = new LocalProvider();
export default localProvider;
