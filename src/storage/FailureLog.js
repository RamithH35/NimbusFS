import mongoose from 'mongoose';

const failureLogSchema = new mongoose.Schema({
  provider: {
    type: String,
    required: true,
  },
  operation: {
    type: String,
    enum: ['upload', 'download', 'delete', 'healthCheck'],
    required: true,
  },
  errorMessage: {
    type: String,
    required: true,
  },
  fileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File',
    default: null,
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  resolvedProvider: {
    type: String,
    default: null,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const FailureLog = mongoose.model('FailureLog', failureLogSchema);
export default FailureLog;
