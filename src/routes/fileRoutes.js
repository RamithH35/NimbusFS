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

const router = Router();

// Configure multer to store uploads as buffer objects in memory
const upload = multer({
  storage: multer.memoryStorage(),
});

// Protect all file endpoints under /api/files
router.use(protect);

// Chunked upload session routes (must be BEFORE /:id based routes)
router.post('/upload/init', initChunkedUpload);
router.post('/upload/chunk', upload.single('chunk'), uploadChunk);
router.post('/upload/complete', completeChunkedUpload);

// Upload endpoint accepts single multipart form-data field named 'file'
router.post('/upload', upload.single('file'), uploadFile);

// Metadata and chunk status operations
router.get('/:id/chunks-status', getChunksStatus);

// Download and metadata operations
router.get('/:id/download', downloadFile);
router.get('/', listFiles);
router.delete('/:id', deleteFile);

// Sharing operations
router.post('/:id/share', shareFile);
router.post('/:id/revoke-share', revokeShare);

export default router;
