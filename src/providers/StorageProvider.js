/**
 * StorageProvider base class defining the contract for all storage providers.
 * Any class extending StorageProvider must implement these methods.
 */
export class StorageProvider {
  /**
   * @param {string} name - Unique identifier for the provider (e.g. 'local', 'cloudinary')
   */
  constructor(name) {
    if (!name) {
      throw new Error('Storage provider must be initialized with a name.');
    }
    this.name = name;
  }

  /**
   * Upload file content
   * @param {Buffer} buffer - File buffer
   * @param {string} originalName - Original filename
   * @param {string} mimeType - File MIME type
   * @returns {Promise<{storedName: string, url: string, size: number}>}
   */
  async upload(buffer, originalName, mimeType) {
    throw new Error(`Method 'upload' is not implemented on provider '${this.name}'`);
  }

  /**
   * Download file content as a stream
   * @param {string} storedName - Stored filename on provider
   * @returns {Promise<import('fs').ReadStream | any>} - Readable stream of the file content
   */
  async download(storedName) {
    throw new Error(`Method 'download' is not implemented on provider '${this.name}'`);
  }

  /**
   * Delete file from provider storage
   * @param {string} storedName - Stored filename on provider
   * @returns {Promise<void>}
   */
  async delete(storedName) {
    throw new Error(`Method 'delete' is not implemented on provider '${this.name}'`);
  }

  /**
   * Check provider health
   * @returns {Promise<{healthy: boolean, latency: number}>}
   */
  async healthCheck() {
    throw new Error(`Method 'healthCheck' is not implemented on provider '${this.name}'`);
  }
}

export default StorageProvider;
