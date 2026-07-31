import jwt from 'jsonwebtoken';
import User from '../auth/User.js';
import { JWT_SECRET } from '../config/env.js';

export const protect = async (req, res, next) => {
  let token;

  // Check Authorization header for Bearer token
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Not authorized, no token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Find user and select all fields except passwordHash
    const user = await User.findById(decoded.userId).select('-passwordHash');

    if (!user) {
      return res.status(401).json({ error: 'Not authorized, user not found' });
    }

    // Check if token version is stale (user logged out and version incremented)
    if (user.tokenVersion !== decoded.tokenVersion) {
      return res.status(401).json({ error: 'Not authorized, token has been revoked' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware verification error:', error.message);
    return res.status(401).json({ error: 'Not authorized, invalid or expired token' });
  }
};
