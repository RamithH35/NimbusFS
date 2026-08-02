import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Owner ID is required'],
  },
  originalName: {
    type: String,
    required: [true, 'Original name is required'],
    trim: true,
  },
  storedName: {
    type: String,
    required: [true, 'Stored name is required'],
    trim: true,
  },
  provider: {
    type: String,
    required: [true, 'Storage provider is required'],
    default: 'local',
  },
  mimeType: {
    type: String,
    required: [true, 'MIME type is required'],
  },
  size: {
    type: Number, // size in bytes
    required: [true, 'File size is required'],
  },
  visibility: {
    type: String,
    enum: ['private', 'shared'],
    default: 'private',
  },
  shareId: {
    type: String,
    default: null,
  },
  sharePasswordHash: {
    type: String,
    default: null,
  },
  expiresAt: {
    type: Date,
    default: null,
  },
  maxDownloads: {
    type: Number,
    default: null,
  },
  downloadCount: {
    type: Number,
    default: 0,
  },
  hash: {
    type: String, // SHA-256 of file buffer
    required: [true, 'File hash is required'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Sparse index for fast lookups by share ID
fileSchema.index({ shareId: 1 }, { sparse: true });

// Exclude sharePasswordHash from all serializations
const cleanResponse = (doc, ret) => {
  delete ret.sharePasswordHash;
  return ret;
};
fileSchema.set('toJSON', { transform: cleanResponse });
fileSchema.set('toObject', { transform: cleanResponse });

const FileModel = mongoose.model('File', fileSchema);
export default FileModel;
