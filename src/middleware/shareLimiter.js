import rateLimit from 'express-rate-limit';

export const shareLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per windowMs
  message: {
    error: 'Too many requests to this share link, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export default shareLimiter;
