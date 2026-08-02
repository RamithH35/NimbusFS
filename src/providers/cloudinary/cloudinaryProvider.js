import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import path from 'path';
import StorageProvider from '../StorageProvider.js';
import {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
} from '../../config/env.js';

export class CloudinaryProvider extends StorageProvider {
  constructor() {
    super('cloudinary');
    this.cloudName = CLOUDINARY_CLOUD_NAME;
    
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
    });
  }

  /**
   * Helper to map file extensions to Cloudinary resource types
   */
  getResourceType(storedName) {
    const ext = path.extname(storedName).toLowerCase();
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
    const videoExtensions = ['.mp4', '.mpeg', '.webm', '.ogv', '.mov', '.qt'];
    if (imageExtensions.includes(ext)) {
      return 'image';
    }
    if (videoExtensions.includes(ext)) {
      return 'video';
    }
    return 'raw';
  }

  /**
   * Upload file to Cloudinary
   * @param {Buffer} buffer 
   * @param {string} originalName 
   * @param {string} mimeType 
   */
  async upload(buffer, originalName, mimeType) {
    const ext = path.extname(originalName);
    const sanitizedBase = path.parse(originalName).name.replace(/[^a-zA-Z0-9]/g, '_');
    const storedName = `${Date.now()}-${sanitizedBase}${ext}`;
    
    const resourceType = this.getResourceType(storedName);
    const publicId = resourceType === 'raw' ? storedName : path.parse(storedName).name;

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'nimbusfs',
          public_id: publicId,
          resource_type: resourceType,
        },
        (error, result) => {
          if (error) {
            return reject(error);
          }
          resolve({
            storedName,
            url: result.secure_url,
            size: result.bytes,
          });
        }
      );

      const readableStream = new Readable();
      readableStream.push(buffer);
      readableStream.push(null);
      readableStream.pipe(uploadStream);
    });
  }

  /**
   * Download file from Cloudinary and return a readable stream
   * @param {string} storedName 
   */
  async download(storedName) {
    const resourceType = this.getResourceType(storedName);
    const url = `https://res.cloudinary.com/${this.cloudName}/${resourceType}/upload/nimbusfs/${storedName}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download file from Cloudinary: ${response.statusText}`);
    }
    return Readable.fromWeb(response.body);
  }

  /**
   * Delete file from Cloudinary
   * @param {string} storedName 
   */
  async delete(storedName) {
    const resourceType = this.getResourceType(storedName);
    const publicId = resourceType === 'raw'
      ? `nimbusfs/${storedName}`
      : `nimbusfs/${path.parse(storedName).name}`;

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });
    if (result.result !== 'ok' && result.result !== 'not found') {
      throw new Error(`Cloudinary delete failed: ${result.result}`);
    }
  }

  /**
   * Health Check
   */
  async healthCheck() {
    const start = Date.now();
    try {
      await cloudinary.api.ping();
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

export const cloudinaryProvider = new CloudinaryProvider();
export default cloudinaryProvider;
