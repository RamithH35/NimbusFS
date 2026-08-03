import { Router } from 'express';
import multer from 'multer';
import {
  uploadFile,
  downloadFile,
  listFiles,
  deleteFile,
  shareFile,
  revokeShare,
  initChunkedUpload,
  uploadChunk,
  completeChunkedUpload,
  getChunksStatus,
} from '../controllers/fileController.js';
import { protect } from '../middleware/auth.js';
import {
  validate,
  initChunkSchema,
  uploadChunkSchema,
  completeChunkSchema,
  shareFileSchema,
  paginationSchema,
} from '../middleware/validate.js';

import { MAX_FILE_SIZE_MB } from '../config/env.js';

const router = Router();

// Configure multer to store uploads as buffer objects in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
  },
});

import { uploadLimiter, chunkUploadLimiter } from '../middleware/rateLimiters.js';

// Protect all file endpoints under /api/files
router.use(protect);

// Chunked upload session routes (must be BEFORE /:id based routes)
router.post('/upload/init', validate(initChunkSchema), initChunkedUpload);
router.post('/upload/chunk', upload.single('chunk'), chunkUploadLimiter, validate(uploadChunkSchema), uploadChunk);
router.post('/upload/complete', validate(completeChunkSchema), completeChunkedUpload);

// Upload endpoint accepts single multipart form-data field named 'file'
router.post('/upload', upload.single('file'), uploadLimiter, uploadFile);

// Metadata and chunk status operations
router.get('/:id/chunks-status', getChunksStatus);

// Download and metadata operations
router.get('/:id/download', downloadFile);
router.get('/', validate(paginationSchema), listFiles);
router.delete('/:id', deleteFile);

// Sharing operations
router.post('/:id/share', validate(shareFileSchema), shareFile);
router.post('/:id/revoke-share', revokeShare);

export default router;
