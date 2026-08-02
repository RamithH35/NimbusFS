import { Router } from 'express';
import { getStorageHealth } from '../controllers/healthController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// Protect all health routes under /api/health
router.use(protect);

router.get('/storage', getStorageHealth);

export default router;
