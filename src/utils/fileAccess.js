import bcrypt from 'bcrypt';

/**
 * Evaluates access permission for a file based on system rules.
 * 
 * @param {Object} file - The database File document
 * @param {Object} req - The Express request object containing user details, query/body params
 * @returns {Promise<{allowed: boolean, reason: string}>}
 */
export async function canAccess(file, req) {
  // a. If req.user exists AND file.ownerId.equals(req.user.id) -> allowed (owner)
  const currentUserId = req.user?._id || req.user?.id;
  if (currentUserId && file.ownerId && file.ownerId.equals(currentUserId)) {
    return { allowed: true, reason: 'owner' };
  }

  // b. If file.visibility !== "shared" -> denied ("File is private")
  if (file.visibility !== 'shared') {
    return { allowed: false, reason: 'File is private' };
  }

  // c. If file.shareId is null -> denied ("No share link exists")
  if (!file.shareId) {
    return { allowed: false, reason: 'No share link exists' };
  }

  // d. If file.expiresAt is set AND file.expiresAt < Date.now() -> denied ("Share link expired")
  if (file.expiresAt && file.expiresAt < new Date()) {
    return { allowed: false, reason: 'Share link expired' };
  }

  // e. If file.maxDownloads is set AND file.downloadCount >= file.maxDownloads -> denied ("Download limit reached")
  if (file.maxDownloads !== null && file.maxDownloads !== undefined) {
    if (file.downloadCount >= file.maxDownloads) {
      return { allowed: false, reason: 'Download limit reached' };
    }
  }

  // f. If file.sharePasswordHash is set AND no password provided in request -> denied ("Password required")
  const password = req.body?.password || req.query?.password;
  if (file.sharePasswordHash) {
    if (!password) {
      return { allowed: false, reason: 'Password required' };
    }

    // g. If file.sharePasswordHash is set AND password provided -> bcrypt.compare -> if no match -> denied ("Invalid password")
    const isMatch = await bcrypt.compare(password, file.sharePasswordHash);
    if (!isMatch) {
      return { allowed: false, reason: 'Invalid password' };
    }
  }

  // h. -> allowed (valid share link)
  return { allowed: true, reason: 'Valid share link' };
}

export default canAccess;
