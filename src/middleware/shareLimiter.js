import rateLimit from 'express-rate-limit';

import { RATE_LIMIT_SHARE_MAX } from '../config/env.js';

export const shareLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: RATE_LIMIT_SHARE_MAX, // Limit each IP to configured requests per windowMs
  message: {
    error: 'Too many requests to this share link, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export default shareLimiter;
