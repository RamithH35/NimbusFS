import { Queue } from 'bullmq';
import connection from './redisConnection.js';

// Initialize the BullMQ Queue named 'upload-retry'
export const uploadRetryQueue = new Queue('upload-retry', { connection });

/**
 * Enqueue a file upload task for background retries
 * @param {Object} jobData 
 * @param {string} jobData.fileBuffer - Base64 string of the file contents
 * @param {string} jobData.originalName - Original filename
 * @param {string} jobData.mimeType - File mimetype
 * @param {string} jobData.ownerId - User ID of the file owner
 * @param {string} jobData.excludeProvider - Name of the provider that failed
 * @param {string} jobData.fileId - Pre-allocated ObjectId string of the File document
 */
export async function addUploadRetryJob(jobData) {
  return uploadRetryQueue.add('retry-upload-job', jobData, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  });
}

export default uploadRetryQueue;
