import { Router } from 'express';
import { register, login, refresh, logout, profile } from './authController.js';
import { protect } from '../middleware/auth.js';
import { authLimiter } from '../middleware/authLimiter.js';

const router = Router();

// Apply stricter rate limiter specifically to registration and login
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);

router.post('/refresh', refresh);
router.post('/logout', logout);

// Profile endpoint protected by JWT verification middleware
router.get('/profile', protect, profile);

export default router;
