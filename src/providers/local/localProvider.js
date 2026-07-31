/* eslint-disable security/detect-non-literal-fs-filename */
import fs from 'fs';
import path from 'path';

const UPLOADS_DIR = path.resolve('uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export const localProvider = {
  /**
   * Upload file to local storage
   * @param {Object} file - Object containing { originalname, buffer }
   * @returns {Promise<Object>} - Promise resolving to { storedName, url }
   */
  upload: async (file) => {
    const ext = path.extname(file.originalname);
    const storedName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}${ext}`;
    const filePath = path.join(UPLOADS_DIR, storedName);

    await fs.promises.writeFile(filePath, file.buffer);
    const url = `/uploads/${storedName}`;

    return { storedName, url };
  },

  /**
   * Download file from local storage
   * @param {string} storedName 
   * @returns {fs.ReadStream} - Readable stream
   */
  download: (storedName) => {
    const filePath = path.join(UPLOADS_DIR, storedName);
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found on storage provider');
    }
    return fs.createReadStream(filePath);
  },

  /**
   * Delete file from local storage
   * @param {string} storedName 
   * @returns {Promise<void>}
   */
  delete: async (storedName) => {
    const filePath = path.join(UPLOADS_DIR, storedName);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    } else {
      throw new Error('File not found on storage provider for deletion');
    }
  },

  /**
   * Health Check
   * @returns {boolean}
   */
  healthCheck: () => {
    try {
      fs.accessSync(UPLOADS_DIR, fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }
};
export default localProvider;
