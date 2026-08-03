import rateLimit from 'express-rate-limit';

import { RATE_LIMIT_AUTH_MAX } from '../config/env.js';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: RATE_LIMIT_AUTH_MAX, // Limit auth attempts per windowMs
  message: {
    error: 'Too many authentication attempts from this IP, please try again after 15 minutes',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,  // Disable the `X-RateLimit-*` headers
});
