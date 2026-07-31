import crypto from 'crypto';
import path from 'path';
import { fileTypeFromBuffer } from 'file-type';
import FileModel from '../storage/File.js';
import { storageManager } from '../storage/storageManager.js';
import { MAX_FILE_SIZE_MB } from '../config/env.js';

// Define supported safe MIME types
const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'];
const allowedVideoTypes = ['video/mp4', 'video/mpeg', 'video/ogg', 'video/webm', 'video/quicktime'];
const allowedPdfTypes = ['application/pdf'];
const allowedZipTypes = ['application/zip', 'application/x-zip-compressed', 'application/x-tar', 'application/gzip', 'application/x-rar-compressed'];
const allowedTextTypes = ['text/plain', 'text/html', 'text/css', 'text/csv', 'text/markdown', 'application/json'];

const allowedMimeTypes = [
  ...allowedImageTypes,
  ...allowedVideoTypes,
  ...allowedPdfTypes,
  ...allowedZipTypes,
  ...allowedTextTypes
];

// @desc    Upload file
// @route   POST /api/files/upload
// @access  Private
export const uploadFile = async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // 1. Enforce max size limit (using MAX_FILE_SIZE_MB from config)
  const maxSizeBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return res.status(413).json({ error: `File size exceeds the limit of ${MAX_FILE_SIZE_MB}MB` });
  }

  try {
    // 2. Validate MIME type by sniffing the buffer
    let detectedMime = file.mimetype;
    const sniffed = await fileTypeFromBuffer(file.buffer);

    if (sniffed) {
      detectedMime = sniffed.mime;
    } else {
      // Fallback logic for text files (which cannot be sniffed by file-type magic numbers)
      const ext = path.extname(file.originalname).slice(1).toLowerCase();
      const textExtensions = new Map([
        ['txt', 'text/plain'],
        ['html', 'text/html'],
        ['css', 'text/css'],
        ['csv', 'text/csv'],
        ['json', 'application/json'],
        ['md', 'text/markdown']
      ]);

      if (textExtensions.has(ext)) {
        detectedMime = textExtensions.get(ext);
      } else {
        return res.status(415).json({ error: 'Unsupported file type' });
      }
    }

    if (!allowedMimeTypes.includes(detectedMime)) {
      return res.status(415).json({ error: 'Unsupported file type' });
    }

    // 3. Compute SHA-256 hash of the file buffer
    const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // 4. Upload via storage manager
    const uploadResult = await storageManager.upload(file);

    // 5. Save metadata to database
    const newFile = new FileModel({
      ownerId: req.user._id,
      originalName: file.originalname,
      storedName: uploadResult.storedName,
      provider: 'local',
      mimeType: detectedMime,
      size: file.size,
      hash,
    });
    await newFile.save();

    return res.status(201).json(newFile);
  } catch (error) {
    console.error('File upload controller error:', error);
    return res.status(500).json({ error: 'Internal server error during upload' });
  }
};

// @desc    Download file
// @route   GET /api/files/:id/download
// @access  Private
export const downloadFile = async (req, res) => {
  try {
    const fileRecord = await FileModel.findById(req.params.id);

    // Checks ownership BEFORE calling storage provider, and does not leak file existence
    if (!fileRecord || fileRecord.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Set streaming headers
    res.setHeader('Content-Type', fileRecord.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(fileRecord.originalName)}"`
    );

    // Stream download
    const stream = storageManager.download(fileRecord.storedName);
    stream.on('error', (err) => {
      console.error('Download read stream error:', err);
      if (!res.headersSent) {
        return res.status(500).json({ error: 'Failed to stream file from storage' });
      }
    });

    stream.pipe(res);
  } catch (error) {
    console.error('File download controller error:', error);
    return res.status(500).json({ error: 'Internal server error during download' });
  }
};

// @desc    List user's files
// @route   GET /api/files
// @access  Private
export const listFiles = async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  try {
    const files = await FileModel.find({ ownerId: req.user._id })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await FileModel.countDocuments({ ownerId: req.user._id });

    return res.status(200).json({
      files,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('File list controller error:', error);
    return res.status(500).json({ error: 'Internal server error listing files' });
  }
};

// @desc    Delete file
// @route   DELETE /api/files/:id
// @access  Private
export const deleteFile = async (req, res) => {
  try {
    const fileRecord = await FileModel.findById(req.params.id);

    if (!fileRecord || fileRecord.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Delete from storage provider first
    try {
      await storageManager.delete(fileRecord.storedName);
    } catch (storageError) {
      console.error('Storage provider delete failed:', storageError);
      // Return 500 and preserve Mongoose metadata if file deletion fails
      return res.status(500).json({
        error: 'Failed to delete file from storage provider. Database metadata has been preserved.',
      });
    }

    // Delete metadata from database
    await FileModel.findByIdAndDelete(req.params.id);
    return res.status(204).send();
  } catch (error) {
    console.error('File delete controller error:', error);
    return res.status(500).json({ error: 'Internal server error during deletion' });
  }
};
