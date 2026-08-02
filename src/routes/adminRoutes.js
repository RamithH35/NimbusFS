import { Router } from 'express';
import { getFailures } from '../controllers/adminController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// Protect all endpoints under /api/admin
router.use(protect);

router.get('/failures', getFailures);

export default router;
