import { localProvider } from '../providers/local/localProvider.js';

// Currently always uses local filesystem provider.
// This wrapper allows future providers (e.g. Cloudinary) to be integrated with minimal changes.
const currentProvider = localProvider;

export const storageManager = {
  /**
   * Upload file using active provider
   */
  upload: async (file) => {
    return currentProvider.upload(file);
  },

  /**
   * Stream file download using active provider
   */
  download: (storedName) => {
    return currentProvider.download(storedName);
  },

  /**
   * Delete file using active provider
   */
  delete: async (storedName) => {
    return currentProvider.delete(storedName);
  },

  /**
   * Check active provider health
   */
  healthCheck: () => {
    return currentProvider.healthCheck();
  }
};
export default storageManager;
