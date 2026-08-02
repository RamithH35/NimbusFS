import { storageManager } from '../storage/storageManager.js';

/**
 * @desc    Get health status of all storage providers
 * @route   GET /api/health/storage
 * @access  Private
 */
export const getStorageHealth = async (req, res) => {
  try {
    const health = await storageManager.healthCheck();
    return res.status(200).json(health);
  } catch (error) {
    console.error('Storage health check controller error:', error);
    return res.status(500).json({ error: 'Internal server error checking storage health' });
  }
};
