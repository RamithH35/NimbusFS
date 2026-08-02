import FileModel from '../storage/File.js';

// In-memory Map keyed by uploadId: { chunks: { [chunkIndex]: Buffer }, createdAt: number }
const chunkStore = new Map();

/**
 * Initializes a chunked upload session in the store
 * @param {string} uploadId 
 */
export function initUpload(uploadId) {
  chunkStore.set(uploadId, {
    chunks: {},
    createdAt: Date.now(),
  });
}

/**
 * Stores a single chunk buffer
 * @param {string} uploadId 
 * @param {number} chunkIndex 
 * @param {Buffer} buffer 
 */
export function storeChunk(uploadId, chunkIndex, buffer) {
  const entry = chunkStore.get(uploadId);
  if (!entry) {
    throw new Error(`Upload session '${uploadId}' not initialized`);
  }
  entry.chunks[chunkIndex] = buffer;
}

/**
 * Retrieves the session details
 * @param {string} uploadId 
 * @returns {Object|undefined}
 */
export function getChunks(uploadId) {
  return chunkStore.get(uploadId);
}

/**
 * Assembles all chunks in correct sequence.
 * Throws an error containing `missingChunks` if any chunks are missing.
 * 
 * @param {string} uploadId 
 * @param {number} totalChunks 
 * @returns {Buffer} assembled combined Buffer
 */
export function assembleChunks(uploadId, totalChunks) {
  const entry = chunkStore.get(uploadId);
  if (!entry) {
    throw new Error(`Upload session '${uploadId}' not found`);
  }

  const chunksArray = [];
  const missingChunks = [];

  for (let i = 0; i < totalChunks; i++) {
    const chunk = entry.chunks[i];
    if (!chunk) {
      missingChunks.push(i);
    } else {
      chunksArray.push(chunk);
    }
  }

  if (missingChunks.length > 0) {
    const error = new Error(`Missing chunks: [${missingChunks.join(', ')}]`);
    error.missingChunks = missingChunks;
    throw error;
  }

  return Buffer.concat(chunksArray);
}

/**
 * Removes chunk session from map
 * @param {string} uploadId 
 */
export function clearChunks(uploadId) {
  chunkStore.delete(uploadId);
}

// Cleanup job running every 5 minutes to clear sessions older than 1 hour
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const SESSION_EXPIRY_MS = 60 * 60 * 1000;

export async function cleanupExpiredSessions() {
  const now = Date.now();
  
  // 1. Clean up in-memory sessions
  for (const [uploadId, entry] of chunkStore.entries()) {
    if (now - entry.createdAt > SESSION_EXPIRY_MS) {
      console.log(`Cleaning up expired chunked upload session '${uploadId}'`);
      chunkStore.delete(uploadId);
      try {
        await FileModel.deleteOne({ uploadId, status: 'uploading' });
        console.log(`Deleted orphaned 'uploading' File record for uploadId '${uploadId}'`);
      } catch (err) {
        console.error(`Failed to delete orphaned File record for uploadId '${uploadId}':`, err.message);
      }
    }
  }

  // 2. Clean up orphaned MongoDB documents older than 1 hour
  try {
    const oneHourAgo = new Date(now - SESSION_EXPIRY_MS);
    const deleteResult = await FileModel.deleteMany({
      status: 'uploading',
      createdAt: { $lt: oneHourAgo }
    });
    if (deleteResult.deletedCount > 0) {
      console.log(`Deleted ${deleteResult.deletedCount} expired 'uploading' File records from MongoDB.`);
    }
  } catch (err) {
    console.error('Failed to clean up expired uploading documents from MongoDB:', err.message);
  }
}

setInterval(async () => {
  await cleanupExpiredSessions();
}, CLEANUP_INTERVAL_MS).unref();

export default {
  initUpload,
  storeChunk,
  getChunks,
  assembleChunks,
  clearChunks,
  cleanupExpiredSessions,
};
