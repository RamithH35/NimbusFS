import FileModel from '../storage/File.js';
import { storageManager } from '../storage/storageManager.js';
import { canAccess } from '../utils/fileAccess.js';

/**
 * @desc    Get public shared file by shareId
 * @route   GET /api/share/:shareId
 * @access  Public (Optional auth)
 */
export const getShare = async (req, res) => {
  try {
    const { shareId } = req.params;

    // Look up file by shareId
    const fileRecord = await FileModel.findOne({ shareId });
    if (!fileRecord) {
      return res.status(404).json({ error: 'Share link not found' });
    }

    // Run central access control utility
    const access = await canAccess(fileRecord, req);
    if (!access.allowed) {
      const reason = access.reason;
      if (reason === 'File is private' || reason === 'No share link exists') {
        return res.status(403).json({ error: 'Forbidden' });
      }
      if (reason === 'Share link expired' || reason === 'Download limit reached') {
        return res.status(410).json({ error: reason });
      }
      if (reason === 'Password required') {
        return res.status(401).json({ error: 'Password required', requiresPassword: true });
      }
      if (reason === 'Invalid password') {
        return res.status(401).json({ error: 'Invalid password' });
      }
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Access allowed! Atomically increment downloadCount
    await FileModel.findByIdAndUpdate(fileRecord._id, { $inc: { downloadCount: 1 } });

    // Set streaming headers
    res.setHeader('Content-Type', fileRecord.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(fileRecord.originalName)}"`
    );

    // Stream download from correct provider
    const stream = await storageManager.download(fileRecord.storedName, fileRecord.provider);
    stream.on('error', (err) => {
      console.error('Share download stream error:', err);
      if (!res.headersSent) {
        return res.status(500).json({ error: 'Failed to stream file from storage' });
      }
    });

    stream.pipe(res);
  } catch (error) {
    console.error('Get share controller error:', error);
    return res.status(500).json({ error: 'Internal server error during download' });
  }
};

export default getShare;
