import mongoose from 'mongoose';
import { localProvider } from '../providers/local/localProvider.js';
import { cloudinaryProvider } from '../providers/cloudinary/cloudinaryProvider.js';
import { supabaseProvider } from '../providers/supabase/supabaseProvider.js';
import FailureLog from './FailureLog.js';
import { addUploadRetryJob } from '../jobs/uploadQueue.js';

// List of registered storage providers in priority order:
// 1. Cloudinary (first choice)
// 2. Supabase (fallback choice)
// 3. Local (last fallback)
const providers = [cloudinaryProvider, supabaseProvider, localProvider];

// Lookup map for fast provider routing by name.
const providerMap = new Map(providers.map(p => [p.name, p]));

export const storageManager = {
  /**
   * Iterate over providers and return the first healthy one, optionally excluding one.
   * Throws an error if no healthy providers are found.
   * @param {string} excludeProvider - Provider name to exclude (optional)
   * @param {boolean} includeLocal - Include local provider in search (default: true)
   * @returns {Promise<import('../providers/StorageProvider.js').default>}
   */
  getHealthyProvider: async (excludeProvider = null, includeLocal = true) => {
    const list = includeLocal ? providers : providers.filter(p => p.name !== 'local');
    for (const provider of list) {
      if (excludeProvider && provider.name === excludeProvider) {
        continue;
      }
      try {
        const health = await provider.healthCheck();
        if (health.healthy) {
          return provider;
        }
      } catch (error) {
        console.warn(`Health check failed for provider ${provider.name}:`, error.message);
      }
    }
    throw new Error('No healthy storage providers available');
  },

  /**
   * Upload file using primary and inline fallback failover with background retry queue.
   * @param {Object} file - Multer file object containing { originalname, buffer, mimetype }
   * @param {string} ownerId - ID of user making the request
   * @returns {Promise<{storedName: string, url: string, size: number, provider: string, _id: mongoose.Types.ObjectId, queued?: boolean}>}
   */
  upload: async (file, ownerId) => {
    const fileId = new mongoose.Types.ObjectId();
    const failedLogs = [];

    // --- STEP 1: Attempt Cloudinary ---
    let cloudinaryHealthy = false;
    try {
      // Check if testing requests failover mock
      const isMockUnhealthy = file.mockUnhealthy === true;
      if (isMockUnhealthy) {
        cloudinaryHealthy = false;
      } else {
        const health = await cloudinaryProvider.healthCheck();
        cloudinaryHealthy = health.healthy;
      }
    } catch (e) {
      cloudinaryHealthy = false;
    }

    if (cloudinaryHealthy) {
      try {
        const result = await cloudinaryProvider.upload(file.buffer, file.originalname, file.mimetype);
        return {
          ...result,
          _id: fileId,
          provider: 'cloudinary',
        };
      } catch (uploadError) {
        console.error('Cloudinary upload threw error:', uploadError.message);
        const log = new FailureLog({
          provider: 'cloudinary',
          operation: 'upload',
          errorMessage: uploadError.message,
          fileId,
          ownerId: ownerId ? new mongoose.Types.ObjectId(ownerId) : null,
        });
        await log.save();
        failedLogs.push(log);
      }
    } else {
      console.warn('Cloudinary health check reports unhealthy. Skipping primary upload.');
      const log = new FailureLog({
        provider: 'cloudinary',
        operation: 'upload',
        errorMessage: 'Cloudinary provider unhealthy during upload health check',
        fileId,
        ownerId: ownerId ? new mongoose.Types.ObjectId(ownerId) : null,
      });
      await log.save();
      failedLogs.push(log);
    }

    // --- STEP 2: Attempt Supabase (Inline Fallback) ---
    let supabaseHealthy = false;
    try {
      const health = await supabaseProvider.healthCheck();
      supabaseHealthy = health.healthy;
    } catch (e) {
      supabaseHealthy = false;
    }

    if (supabaseHealthy) {
      try {
        console.log('Attempting inline failover upload to Supabase...');
        const result = await supabaseProvider.upload(file.buffer, file.originalname, file.mimetype);

        // Resolve previous failed Cloudinary log
        for (const log of failedLogs) {
          log.resolvedProvider = 'supabase';
          await log.save();
        }

        return {
          ...result,
          _id: fileId,
          provider: 'supabase',
        };
      } catch (uploadError) {
        console.error('Supabase upload threw error:', uploadError.message);
        const log = new FailureLog({
          provider: 'supabase',
          operation: 'upload',
          errorMessage: uploadError.message,
          fileId,
          ownerId: ownerId ? new mongoose.Types.ObjectId(ownerId) : null,
        });
        await log.save();
      }
    } else {
      console.warn('Supabase health check reports unhealthy. Skipping inline fallback.');
      const log = new FailureLog({
        provider: 'supabase',
        operation: 'upload',
        errorMessage: 'Supabase provider unhealthy during upload health check',
        fileId,
        ownerId: ownerId ? new mongoose.Types.ObjectId(ownerId) : null,
      });
      await log.save();
    }

    // --- STEP 3: Both Failed: Queue for Background retry ---
    console.log('Both Cloudinary and Supabase uploads failed. Enqueuing BullMQ retry task...');
    const fileBufferBase64 = file.buffer.toString('base64');
    
    await addUploadRetryJob({
      fileBuffer: fileBufferBase64,
      originalName: file.originalname,
      mimeType: file.mimetype,
      ownerId,
      excludeProvider: 'supabase', // Exclude Supabase in background job
      fileId: fileId.toString(),
    });

    return {
      _id: fileId,
      queued: true,
      provider: 'queued',
      storedName: 'queued_for_retry',
      url: '',
      size: file.size,
    };
  },

  /**
   * Stream file download using the stored provider
   * @param {string} storedName 
   * @param {string} providerName
   * @returns {Promise<any>} - Readable stream
   */
  download: async (storedName, providerName = 'local') => {
    const provider = providerMap.get(providerName);
    if (!provider) {
      throw new Error(`Storage provider '${providerName}' not found.`);
    }
    return provider.download(storedName);
  },

  /**
   * Delete file using the stored provider
   * @param {string} storedName 
   * @param {string} providerName
   * @returns {Promise<void>}
   */
  delete: async (storedName, providerName = 'local') => {
    const provider = providerMap.get(providerName);
    if (!provider) {
      throw new Error(`Storage provider '${providerName}' not found.`);
    }
    return provider.delete(storedName);
  },

  /**
   * Check health of all registered providers including failure metrics and background queue counts
   * @returns {Promise<{providers: Array<Object>, queue: Object}>}
   */
  healthCheck: async () => {
    // 1. Fetch BullMQ Queue job counts
    let queueStats = { waiting: 0, active: 0, failed: 0 };
    try {
      const { uploadRetryQueue } = await import('../jobs/uploadQueue.js');
      const counts = await uploadRetryQueue.getJobCounts('wait', 'active', 'failed');
      queueStats = {
        waiting: counts.wait || 0,
        active: counts.active || 0,
        failed: counts.failed || 0,
      };
    } catch (err) {
      console.error('Failed to retrieve BullMQ queue stats:', err.message);
    }

    // 2. Fetch health and database failure metrics for each provider
    const healthResults = await Promise.all(
      providers.map(async (provider) => {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        let failures24h = 0;
        let lastFailure = null;

        try {
          // Query database failure logs in last 24h
          failures24h = await FailureLog.countDocuments({
            provider: provider.name,
            timestamp: { $gte: oneDayAgo },
          });

          // Query last failure timestamp
          const lastLog = await FailureLog.findOne({ provider: provider.name })
            .sort({ timestamp: -1 })
            .select('timestamp');
          lastFailure = lastLog ? lastLog.timestamp : null;
        } catch (dbError) {
          console.error(`Failed to query database failure logs for ${provider.name}:`, dbError.message);
        }

        try {
          const health = await provider.healthCheck();
          return {
            provider: provider.name,
            healthy: health.healthy,
            latency: health.latency,
            failures24h,
            lastFailure,
          };
        } catch (error) {
          return {
            provider: provider.name,
            healthy: false,
            latency: 0,
            failures24h,
            lastFailure,
            error: error.message,
          };
        }
      })
    );

    return {
      providers: healthResults,
      queue: queueStats,
    };
  }
};

export default storageManager;
