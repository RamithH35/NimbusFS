import { Router } from 'express';
import { getShare } from '../controllers/shareController.js';
import { shareLimiter } from '../middleware/shareLimiter.js';
import { optionalProtect } from '../middleware/auth.js';

const router = Router();

// GET/POST /api/share/:shareId is public but rate limited and optionally checks owner identity
// Supports password input via body (POST) or query string (GET)
router.route('/:shareId')
  .get(shareLimiter, optionalProtect, getShare)
  .post(shareLimiter, optionalProtect, getShare);

export default router;
