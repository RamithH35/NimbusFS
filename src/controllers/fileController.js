import crypto from 'crypto';
import path from 'path';
import { fileTypeFromBuffer } from 'file-type';
import FileModel from '../storage/File.js';
import { storageManager } from '../storage/storageManager.js';
import { MAX_FILE_SIZE_MB, FRONTEND_URL } from '../config/env.js';
import { nanoid } from 'nanoid';
import bcrypt from 'bcrypt';
import { canAccess } from '../utils/fileAccess.js';
import { computeHash } from '../utils/hashing.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { initUpload, storeChunk, getChunks, assembleChunks, clearChunks } from '../utils/chunkStore.js';

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

    // 3. Compute SHA-256 hash of the original plaintext buffer
    const hash = computeHash(file.buffer);

    // 4. Check deduplication (user-scoped)
    const duplicate = await FileModel.findOne({ hash, ownerId: req.user._id });
    if (duplicate) {
      const dupObj = duplicate.toObject();
      dupObj.isDuplicate = true;
      return res.status(200).json(dupObj);
    }

    // 5. If no duplicate: encrypt the buffer
    const { encryptedBuffer, iv, authTag } = encrypt(file.buffer);

    // Mutate file.buffer to point to encryptedBuffer so storageManager.upload works seamlessly
    file.buffer = encryptedBuffer;
    
    // Check for test mock failover flag
    if (req.headers['x-mock-cloudinary-unhealthy'] === 'true') {
      file.mockUnhealthy = true;
    }

    // 6. Upload via storage manager (passing ownerId for logging)
    const uploadResult = await storageManager.upload(file, req.user._id);

    // 7. Save metadata to database
    const newFile = new FileModel({
      _id: uploadResult._id,
      ownerId: req.user._id,
      originalName: file.originalname,
      storedName: uploadResult.storedName,
      provider: uploadResult.provider || 'local',
      mimeType: detectedMime,
      size: file.size,
      hash,
      iv,
      authTag,
    });
    await newFile.save();

    if (uploadResult.queued) {
      return res.status(202).json({
        message: 'Upload queued for retry',
        fileId: newFile._id,
      });
    }

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
    if (!fileRecord) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Use central access control utility
    const access = await canAccess(fileRecord, req);
    if (!access.allowed) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Set streaming headers
    res.setHeader('Content-Type', fileRecord.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(fileRecord.originalName)}"`
    );

    // Stream download
    const stream = await storageManager.download(fileRecord.storedName, fileRecord.provider);
    
    const chunks = [];
    stream.on('error', (err) => {
      console.error('Download read stream error:', err);
      if (!res.headersSent) {
        return res.status(500).json({ error: 'Failed to stream file from storage' });
      }
    });

    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const encryptedBuffer = Buffer.concat(chunks);

    // Decrypt if iv and authTag are present
    let decryptedBuffer = encryptedBuffer;
    if (fileRecord.iv && fileRecord.authTag) {
      decryptedBuffer = decrypt(encryptedBuffer, fileRecord.iv, fileRecord.authTag);
    }

    res.send(decryptedBuffer);
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
      await storageManager.delete(fileRecord.storedName, fileRecord.provider);
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

// @desc    Share file
// @route   POST /api/files/:id/share
// @access  Private (Owner only)
export const shareFile = async (req, res) => {
  try {
    const fileRecord = await FileModel.findById(req.params.id);
    if (!fileRecord) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Verify ownership
    if (fileRecord.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { expiresIn, password, maxDownloads } = req.body;

    // Generate 21-character URL-safe nanoid
    const shareId = nanoid(21);

    // Calculate expiry
    let expiresAt = null;
    if (expiresIn === '1h') {
      expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    } else if (expiresIn === '1d') {
      expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    } else if (expiresIn === '7d') {
      expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    // Hash password if provided
    let sharePasswordHash = null;
    if (password) {
      sharePasswordHash = await bcrypt.hash(password, 10);
    }

    fileRecord.visibility = 'shared';
    fileRecord.shareId = shareId;
    fileRecord.expiresAt = expiresAt;
    fileRecord.sharePasswordHash = sharePasswordHash;
    fileRecord.maxDownloads = maxDownloads ? parseInt(maxDownloads, 10) : null;
    fileRecord.downloadCount = 0;

    await fileRecord.save();

    const host = FRONTEND_URL.replace(/^https?:\/\//, '');
    const shareUrl = `https://${host}/share/${shareId}`;

    const fileObj = fileRecord.toObject();
    delete fileObj.sharePasswordHash;

    return res.status(200).json({
      shareUrl,
      file: fileObj,
    });
  } catch (error) {
    console.error('Share file controller error:', error);
    return res.status(500).json({ error: 'Internal server error during share' });
  }
};

// @desc    Revoke shared file
// @route   POST /api/files/:id/revoke-share
// @access  Private (Owner only)
export const revokeShare = async (req, res) => {
  try {
    const fileRecord = await FileModel.findById(req.params.id);
    if (!fileRecord) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Verify ownership
    if (fileRecord.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    fileRecord.visibility = 'private';
    fileRecord.shareId = null;
    fileRecord.sharePasswordHash = null;
    fileRecord.expiresAt = null;
    fileRecord.maxDownloads = null;
    fileRecord.downloadCount = 0;

    await fileRecord.save();

    const fileObj = fileRecord.toObject();
    delete fileObj.sharePasswordHash;

    return res.status(200).json(fileObj);
  } catch (error) {
    console.error('Revoke share controller error:', error);
    return res.status(500).json({ error: 'Internal server error revoking share' });
  }
};

// @desc    Initialize chunked upload session
// @route   POST /api/files/upload/init
// @access  Private
export const initChunkedUpload = async (req, res) => {
  try {
    const { originalName, mimeType, totalSize, totalChunks } = req.body;

    // Validate size limit
    const maxSizeBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
    if (totalSize > maxSizeBytes) {
      return res.status(413).json({ error: `File size exceeds the limit of ${MAX_FILE_SIZE_MB}MB` });
    }

    // Validate chunks range
    const chunks = parseInt(totalChunks, 10);
    if (isNaN(chunks) || chunks < 1 || chunks > 100) {
      return res.status(400).json({ error: 'totalChunks must be between 1 and 100' });
    }

    // Validate MIME type
    if (!allowedMimeTypes.includes(mimeType)) {
      return res.status(415).json({ error: 'Unsupported file type' });
    }

    const uploadId = nanoid(21);

    const file = new FileModel({
      originalName,
      mimeType,
      ownerId: req.user._id,
      isChunked: true,
      totalChunks: chunks,
      uploadId,
      status: 'uploading',
      visibility: 'private',
      size: totalSize,
    });
    await file.save();

    initUpload(uploadId);

    return res.status(201).json({
      uploadId,
      fileId: file._id,
    });
  } catch (error) {
    console.error('Init chunked upload error:', error);
    return res.status(500).json({ error: 'Internal server error initializing chunked upload' });
  }
};

// @desc    Upload chunk of a file
// @route   POST /api/files/upload/chunk
// @access  Private
export const uploadChunk = async (req, res) => {
  try {
    const { uploadId, chunkIndex } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: 'No chunk file uploaded' });
    }

    const entry = getChunks(uploadId);
    if (!entry) {
      return res.status(400).json({ error: 'Upload session not found or expired' });
    }

    // Query DB by uploadId + ownerId
    const fileRecord = await FileModel.findOne({ uploadId, ownerId: req.user._id });
    if (!fileRecord) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const chunkIdx = parseInt(chunkIndex, 10);
    if (isNaN(chunkIdx) || chunkIdx < 0 || chunkIdx >= fileRecord.totalChunks) {
      return res.status(400).json({ error: 'Invalid chunkIndex' });
    }

    storeChunk(uploadId, chunkIdx, req.file.buffer);

    return res.status(200).json({
      received: true,
      chunkIndex: chunkIdx,
    });
  } catch (error) {
    console.error('Upload chunk error:', error);
    return res.status(500).json({ error: 'Internal server error uploading chunk' });
  }
};

// @desc    Complete chunked upload
// @route   POST /api/files/upload/complete
// @access  Private
export const completeChunkedUpload = async (req, res) => {
  try {
    const { uploadId, totalChunks } = req.body;

    const fileRecord = await FileModel.findOne({ uploadId, ownerId: req.user._id, status: 'uploading' });
    if (!fileRecord) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const chunks = parseInt(totalChunks, 10);

    let assembledBuffer;
    try {
      assembledBuffer = assembleChunks(uploadId, chunks);
    } catch (err) {
      if (err.missingChunks) {
        return res.status(400).json({ error: `Missing chunks: [${err.missingChunks.join(', ')}]` });
      }
      throw err;
    }

    // Compute SHA-256 hash on reassembled plaintext buffer
    const hash = computeHash(assembledBuffer);

    // Check deduplication
    const duplicate = await FileModel.findOne({ hash, ownerId: req.user._id, status: 'complete' });
    if (duplicate) {
      clearChunks(uploadId);
      await FileModel.deleteOne({ _id: fileRecord._id });
      const dupObj = duplicate.toObject();
      dupObj.isDuplicate = true;
      return res.status(200).json(dupObj);
    }

    // Encrypt assembled buffer
    const { encryptedBuffer, iv, authTag } = encrypt(assembledBuffer);

    // Create file object for StorageManager
    const fileObj = {
      buffer: encryptedBuffer,
      originalname: fileRecord.originalName,
      mimetype: fileRecord.mimeType,
      size: assembledBuffer.length,
    };

    // Upload via storage manager
    const uploadResult = await storageManager.upload(fileObj, req.user._id);

    fileRecord.storedName = uploadResult.storedName;
    fileRecord.provider = uploadResult.provider || 'local';
    fileRecord.hash = hash;
    fileRecord.iv = iv;
    fileRecord.authTag = authTag;
    fileRecord.status = 'complete';
    fileRecord.size = assembledBuffer.length;
    await fileRecord.save();

    clearChunks(uploadId);

    if (uploadResult.queued) {
      return res.status(202).json({
        message: 'Upload queued for retry',
        fileId: fileRecord._id,
      });
    }

    return res.status(200).json(fileRecord);
  } catch (error) {
    console.error('Complete chunked upload error:', error);
    return res.status(500).json({ error: 'Internal server error completing upload' });
  }
};

// @desc    Get received chunks status
// @route   GET /api/files/:id/chunks-status
// @access  Private
export const getChunksStatus = async (req, res) => {
  try {
    const fileRecord = await FileModel.findById(req.params.id);
    if (!fileRecord) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Verify ownership
    if (fileRecord.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!fileRecord.isChunked) {
      return res.status(400).json({ error: 'File is not chunked' });
    }

    const total = fileRecord.totalChunks;
    let receivedChunks = 0;
    const missingChunks = [];

    const entry = getChunks(fileRecord.uploadId);

    if (fileRecord.status === 'complete') {
      receivedChunks = total;
    } else if (entry) {
      for (let i = 0; i < total; i++) {
        if (entry.chunks[i]) {
          receivedChunks++;
        } else {
          missingChunks.push(i);
        }
      }
    } else {
      for (let i = 0; i < total; i++) {
        missingChunks.push(i);
      }
    }

    return res.status(200).json({
      uploadId: fileRecord.uploadId,
      receivedChunks,
      totalChunks: total,
      missingChunks,
    });
  } catch (error) {
    console.error('Get chunks status error:', error);
    return res.status(500).json({ error: 'Internal server error fetching chunk status' });
  }
};
