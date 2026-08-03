import rateLimit from 'express-rate-limit';
import {
  RATE_LIMIT_FORGOT_PASSWORD_MAX,
  RATE_LIMIT_UPLOAD_MAX,
  RATE_LIMIT_UPLOAD_CHUNK_MAX,
  RATE_LIMIT_ADMIN_MAX,
} from '../config/env.js';

// 1. forgot password rate limiter (3 per hour per IP)
export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: RATE_LIMIT_FORGOT_PASSWORD_MAX,
  message: {
    error: 'Too many password reset requests, please try again after an hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 2. file upload rate limiter (30 per hour per authenticated user)
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: RATE_LIMIT_UPLOAD_MAX,
  keyGenerator: (req) => req.user ? req.user._id.toString() : req.ip,
  validate: { keyGenerator: false },
  message: {
    error: 'Upload limit exceeded, please try again after an hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 3. chunk upload rate limiter (200 per hour per authenticated user)
export const chunkUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: RATE_LIMIT_UPLOAD_CHUNK_MAX,
  keyGenerator: (req) => req.user ? req.user._id.toString() : req.ip,
  validate: { keyGenerator: false },
  message: {
    error: 'Chunk upload limit exceeded, please try again after an hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 4. admin routes rate limiter (60 per 15 min per IP)
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: RATE_LIMIT_ADMIN_MAX,
  message: {
    error: 'Too many admin requests, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
