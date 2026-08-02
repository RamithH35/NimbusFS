import { Worker } from 'bullmq';
import crypto from 'crypto';
import connection from './redisConnection.js';
import { storageManager } from '../storage/storageManager.js';
import FileModel from '../storage/File.js';
import FailureLog from '../storage/FailureLog.js';

let worker = null;

/**
 * Start the BullMQ background worker for 'upload-retry' queue
 */
export function startUploadWorker() {
  if (worker) {
    console.log('BullMQ worker is already running.');
    return worker;
  }

  worker = new Worker(
    'upload-retry',
    async (job) => {
      const { fileBuffer, originalName, mimeType, ownerId, excludeProvider, fileId } = job.data;
      console.log(`Processing retry upload job ${job.id} for file: ${originalName}`);

      // a. Decode fileBuffer from base64 back to Buffer
      const buffer = Buffer.from(fileBuffer, 'base64');

      // b. Get a healthy provider excluding the one that failed
      const provider = await storageManager.getHealthyProvider(excludeProvider);
      console.log(`Worker selected healthy fallback provider: ${provider.name}`);

      // c. Call provider.upload(buffer, originalName, mimeType)
      const uploadResult = await provider.upload(buffer, originalName, mimeType);

      // d. Update or create the File document in MongoDB
      if (fileId) {
        await FileModel.findByIdAndUpdate(fileId, {
          provider: provider.name,
          storedName: uploadResult.storedName,
          size: uploadResult.size || buffer.length,
        });
        console.log(`Updated existing database record ${fileId} to point to ${provider.name}`);
      } else {
        const hash = crypto.createHash('sha256').update(buffer).digest('hex');
        const newFile = new FileModel({
          ownerId,
          originalName,
          storedName: uploadResult.storedName,
          provider: provider.name,
          mimeType,
          size: uploadResult.size || buffer.length,
          hash,
        });
        await newFile.save();
        console.log(`Created new database record for ${originalName} on provider ${provider.name}`);
      }

      console.log(`BullMQ job ${job.id} completed successfully: uploaded to ${provider.name}`);
    },
    { connection }
  );

  // Failure listener (triggered on job failure)
  worker.on('failed', async (job, error) => {
    console.error(`BullMQ job ${job?.id} failed after attempt:`, error.message);

    // Only log to FailureLog when all attempts are exhausted (attempts: 3)
    if (job && job.attemptsMade >= 3) {
      try {
        const { originalName, ownerId, excludeProvider, fileId } = job.data;
        const failureLog = new FailureLog({
          provider: excludeProvider || 'unknown',
          operation: 'upload',
          errorMessage: `Background retry worker exhausted attempts. last error: ${error.message}`,
          fileId: fileId || null,
          ownerId: ownerId || null,
          resolvedProvider: null, // Resolving failed entirely
        });
        await failureLog.save();
        console.error(`Background retries exhausted. Logged failure for '${originalName}' to database.`);
      } catch (logError) {
        console.error('Failed to save FailureLog on background worker job failure:', logError);
      }
    }
  });

  console.log('BullMQ worker started.');
  return worker;
}

export default startUploadWorker;
