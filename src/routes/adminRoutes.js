import { Router } from 'express';
import { getFailures } from '../controllers/adminController.js';
import { protect } from '../middleware/auth.js';
import { cleanupExpiredSessions } from '../utils/chunkStore.js';

import { validate, adminFailuresSchema } from '../middleware/validate.js';

import { adminLimiter } from '../middleware/rateLimiters.js';

const router = Router();

// Protect all endpoints under /api/admin
router.use(protect, adminLimiter);

router.get('/failures', validate(adminFailuresSchema), getFailures);

router.post('/cleanup-chunks', async (req, res) => {
  try {
    await cleanupExpiredSessions();
    res.status(200).json({ success: true, message: 'Chunk cleanup executed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
