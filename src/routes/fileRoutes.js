import { Router } from 'express';
import multer from 'multer';
import { uploadFile, downloadFile, listFiles, deleteFile } from '../controllers/fileController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// Configure multer to store uploads as buffer objects in memory
const upload = multer({
  storage: multer.memoryStorage(),
});

// Protect all file endpoints under /api/files
router.use(protect);

// Upload endpoint accepts single multipart form-data field named 'file'
router.post('/upload', upload.single('file'), uploadFile);

// Download and metadata operations
router.get('/:id/download', downloadFile);
router.get('/', listFiles);
router.delete('/:id', deleteFile);

export default router;
