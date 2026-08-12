import mongoose from 'mongoose';
import { localProvider } from '../providers/local/localProvider.js';
import { cloudinaryProvider } from '../providers/cloudinary/cloudinaryProvider.js';
import { SupabaseProvider } from '../providers/supabase/supabaseProvider.js';
import FailureLog from './FailureLog.js';
import { addUploadRetryJob } from '../jobs/uploadQueue.js';
import {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_BUCKET,
  SUPABASE_URL_2,
  SUPABASE_SERVICE_ROLE_KEY_2,
  SUPABASE_BUCKET_2
} from '../config/env.js';

// Instantiate Supabase providers
const supabasePrimary = new SupabaseProvider({
  url: SUPABASE_URL,
  serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
  bucket: SUPABASE_BUCKET,
  name: 'supabase-primary'
});

const supabaseFallback = new SupabaseProvider({
  url: SUPABASE_URL_2,
  serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY_2,
  bucket: SUPABASE_BUCKET_2,
  name: 'supabase-fallback'
});

// Setup 2000ms timeout wrapper for supabaseFallback healthCheck specifically
const originalFallbackHealthCheck = supabaseFallback.healthCheck.bind(supabaseFallback);
supabaseFallback.healthCheck = async () => {
  let timeoutId;
  const timeoutPromise = new Promise((resolve) => {
    timeoutId = setTimeout(() => {
      resolve({ healthy: false, latency: 2000, timedOut: true });
    }, 2000);
  });
  try {
    return await Promise.race([originalFallbackHealthCheck(), timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
};

// List of registered storage providers in priority order:
// 1. Cloudinary
// 2. Supabase Primary
// 3. Supabase Fallback
// 4. Local
const providers = [cloudinaryProvider, supabasePrimary, supabaseFallback, localProvider];

// Lookup map for fast provider routing by name, with legacy support for 'supabase'.
const providerMap = new Map([
  ...providers.map(p => [p.name, p]),
  ['supabase', supabasePrimary]
]);

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
      if (excludeProvider) {
        if (provider.name === excludeProvider) {
          continue;
        }
        // If legacy 'supabase' is excluded, exclude both primary and fallback
        if (excludeProvider === 'supabase' && provider.name.startsWith('supabase-')) {
          continue;
        }
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

    // --- STEP 2: Attempt Supabase Primary (Inline Fallback) ---
    let supabasePrimaryHealthy = false;
    try {
      const health = await supabasePrimary.healthCheck();
      supabasePrimaryHealthy = health.healthy;
    } catch (e) {
      supabasePrimaryHealthy = false;
    }

    if (supabasePrimaryHealthy) {
      try {
        console.log('Attempting inline failover upload to Supabase Primary...');
        const result = await supabasePrimary.upload(file.buffer, file.originalname, file.mimetype);

        // Resolve previous failed Cloudinary logs
        for (const log of failedLogs) {
          log.resolvedProvider = 'supabase-primary';
          await log.save();
        }

        return {
          ...result,
          _id: fileId,
          provider: 'supabase-primary',
        };
      } catch (uploadError) {
        console.error('Supabase Primary upload threw error:', uploadError.message);
        const log = new FailureLog({
          provider: 'supabase-primary',
          operation: 'upload',
          errorMessage: uploadError.message,
          fileId,
          ownerId: ownerId ? new mongoose.Types.ObjectId(ownerId) : null,
        });
        await log.save();
        failedLogs.push(log);
      }
    } else {
      console.warn('Supabase Primary health check reports unhealthy. Skipping.');
      const log = new FailureLog({
        provider: 'supabase-primary',
        operation: 'upload',
        errorMessage: 'Supabase Primary provider unhealthy during upload health check',
        fileId,
        ownerId: ownerId ? new mongoose.Types.ObjectId(ownerId) : null,
      });
      await log.save();
      failedLogs.push(log);
    }

    // --- STEP 3: Attempt Supabase Fallback (Second Fallback) ---
    let supabaseFallbackHealthy = false;
    try {
      const health = await supabaseFallback.healthCheck();
      supabaseFallbackHealthy = health.healthy;
    } catch (e) {
      supabaseFallbackHealthy = false;
    }

    if (supabaseFallbackHealthy) {
      try {
        console.log('Attempting inline failover upload to Supabase Fallback...');
        const result = await supabaseFallback.upload(file.buffer, file.originalname, file.mimetype);

        // Resolve previous failed logs
        for (const log of failedLogs) {
          log.resolvedProvider = 'supabase-fallback';
          await log.save();
        }

        return {
          ...result,
          _id: fileId,
          provider: 'supabase-fallback',
        };
      } catch (uploadError) {
        console.error('Supabase Fallback upload threw error:', uploadError.message);
        const log = new FailureLog({
          provider: 'supabase-fallback',
          operation: 'upload',
          errorMessage: uploadError.message,
          fileId,
          ownerId: ownerId ? new mongoose.Types.ObjectId(ownerId) : null,
        });
        await log.save();
        failedLogs.push(log);
      }
    } else {
      console.warn('Supabase Fallback health check reports unhealthy. Skipping.');
      const log = new FailureLog({
        provider: 'supabase-fallback',
        operation: 'upload',
        errorMessage: 'Supabase Fallback provider unhealthy during upload health check',
        fileId,
        ownerId: ownerId ? new mongoose.Types.ObjectId(ownerId) : null,
      });
      await log.save();
      failedLogs.push(log);
    }

    // --- STEP 4: All Cloud Providers Failed: Queue for Background retry ---
    console.log('All cloud uploads failed. Enqueuing BullMQ retry task...');
    const fileBufferBase64 = file.buffer.toString('base64');
    
    await addUploadRetryJob({
      fileBuffer: fileBufferBase64,
      originalName: file.originalname,
      mimeType: file.mimetype,
      ownerId,
      excludeProvider: 'supabase', // Excludes both supabase instances in background job
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
            ...(health.timedOut ? { timedOut: true } : {})
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

