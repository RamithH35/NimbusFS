import { createClient } from '@supabase/supabase-js';
import { Readable } from 'stream';
import path from 'path';
import StorageProvider from '../StorageProvider.js';
import { retryWithBackoff } from '../../utils/retry.js';
import {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_BUCKET,
} from '../../config/env.js';

export class SupabaseProvider extends StorageProvider {
  constructor() {
    super('supabase');
    this.bucketName = SUPABASE_BUCKET;
    this.supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }

  /**
   * Upload file to Supabase Storage with retry backoff
   * @param {Buffer} buffer 
   * @param {string} originalName 
   * @param {string} mimeType 
   */
  async upload(buffer, originalName, mimeType) {
    const ext = path.extname(originalName);
    const sanitizedBase = path.parse(originalName).name.replace(/[^a-zA-Z0-9]/g, '_');
    const storedName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}${ext}`;
    const filePath = `uploads/${storedName}`;

    return retryWithBackoff(async () => {
      // Upload using service role key (RLS bypass)
      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(filePath, buffer, {
          contentType: mimeType,
          duplex: 'half',
        });

      if (error) {
        throw error;
      }

      const { data: urlData } = this.supabase.storage
        .from(this.bucketName)
        .getPublicUrl(filePath);

      return {
        storedName,
        url: urlData.publicUrl,
        size: buffer.length,
      };
    }, 3, 200);
  }

  /**
   * Download file from Supabase Storage as a stream with retry backoff
   * @param {string} storedName 
   */
  async download(storedName) {
    return retryWithBackoff(async () => {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .download(`uploads/${storedName}`);

      if (error) {
        throw error;
      }

      // Convert Supabase download Blob to Node.js Readable stream
      const arrayBuffer = await data.arrayBuffer();
      return Readable.from(Buffer.from(arrayBuffer));
    }, 3, 200);
  }

  /**
   * Delete file from Supabase Storage with retry backoff
   * @param {string} storedName 
   */
  async delete(storedName) {
    return retryWithBackoff(async () => {
      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .remove([`uploads/${storedName}`]);

      if (error) {
        throw error;
      }
    }, 3, 200);
  }

  /**
   * Health Check
   */
  async healthCheck() {
    const start = Date.now();
    try {
      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .list('uploads', { limit: 1 });

      if (error) throw error;

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

export const supabaseProvider = new SupabaseProvider();
export default supabaseProvider;
