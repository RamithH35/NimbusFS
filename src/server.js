import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import authRouter from './auth/authRoutes.js';
import fileRouter from './routes/fileRoutes.js';
import healthRouter from './routes/healthRoutes.js';
import adminRouter from './routes/adminRoutes.js';
import shareRouter from './routes/shareRoutes.js';
import { startUploadWorker } from './jobs/uploadWorker.js';
import './jobs/redisConnection.js';

const app = express();

// Apply security headers
app.use(helmet());

// Configure CORS
const allowedOrigin = process.env.ALLOWED_ORIGIN;
if (!allowedOrigin) {
  console.warn('WARNING: ALLOWED_ORIGIN environment variable is not defined.');
}

app.use(cors({
  origin: (origin, callback) => {
    // If no origin (e.g. server-to-server or curl), allow it or reject depending on requirements.
    // For standard web app security:
    if (!origin) {
      return callback(null, true);
    }
    if (origin === allowedOrigin) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

import { RATE_LIMIT_GLOBAL_MAX } from './config/env.js';

// Apply global rate limiter (100 requests per 15 minutes per IP by default)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: RATE_LIMIT_GLOBAL_MAX, // Limit each IP per window
  message: {
    status: 429,
    message: 'Too many requests from this IP, please try again after 15 minutes.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,  // Disable the `X-RateLimit-*` headers
});
app.use(globalLimiter);

// Parse JSON request bodies
app.use(express.json());

// Parse cookies
app.use(cookieParser());

// Auth Routes
app.use('/api/auth', authRouter);

// File Routes
app.use('/api/files', fileRouter);

// Health Routes
app.use('/api/health', healthRouter);

// Admin Routes
app.use('/api/admin', adminRouter);

// Share Routes
app.use('/api/share', shareRouter);

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'NimbusFS Server is healthy.' });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  const isProduction = process.env.NODE_ENV === 'production';
  res.status(err.status || 500).json({
    error: isProduction ? 'Internal server error' : err.message,
    ...(isProduction ? {} : { stack: err.stack }),
  });
});

// Database connection and server initialization
const PORT = parseInt(process.env.PORT, 10) || 5000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('CRITICAL ERROR: MONGO_URI is not defined in the environment variables.');
  process.exit(1);
}

console.log('Connecting to MongoDB...');
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Successfully connected to MongoDB.');
    // Start background worker
    try {
      startUploadWorker();
      console.log('BullMQ worker started successfully.');
    } catch (workerError) {
      console.error('Failed to start BullMQ worker:', workerError.message);
    }
    app.listen(PORT, () => {
      console.log(`Server is listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('CRITICAL ERROR: Failed to connect to MongoDB on startup. Exiting.');
    console.error(error);
    process.exit(1);
  });
