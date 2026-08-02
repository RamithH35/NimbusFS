import { localProvider } from '../providers/local/localProvider.js';
import { cloudinaryProvider } from '../providers/cloudinary/cloudinaryProvider.js';
import { supabaseProvider } from '../providers/supabase/supabaseProvider.js';

// List of registered storage providers in priority order:
// 1. Cloudinary (first choice)
// 2. Supabase (fallback choice)
// 3. Local (last fallback)
const providers = [cloudinaryProvider, supabaseProvider, localProvider];

// Lookup map for fast provider routing by name.
const providerMap = new Map(providers.map(p => [p.name, p]));

export const storageManager = {
  /**
   * Iterate over providers and return the first healthy one.
   * Throws an error if no healthy providers are found.
   * @returns {Promise<import('../providers/StorageProvider.js').default>}
   */
  getHealthyProvider: async () => {
    for (const provider of providers) {
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
   * Upload file using the first available healthy provider
   * @param {Object} file - Multer file object containing { originalname, buffer, mimetype }
   * @returns {Promise<{storedName: string, url: string, size: number, provider: string}>}
   */
  upload: async (file) => {
    const provider = await storageManager.getHealthyProvider();
    const result = await provider.upload(file.buffer, file.originalname, file.mimetype);
    return {
      ...result,
      provider: provider.name,
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
   * Check health of all registered providers
   * @returns {Promise<Array<{provider: string, healthy: boolean, latency: number}>>}
   */
  healthCheck: async () => {
    return Promise.all(
      providers.map(async (provider) => {
        try {
          const health = await provider.healthCheck();
          return {
            provider: provider.name,
            healthy: health.healthy,
            latency: health.latency,
          };
        } catch (error) {
          return {
            provider: provider.name,
            healthy: false,
            latency: 0,
            error: error.message,
          };
        }
      })
    );
  }
};

export default storageManager;
