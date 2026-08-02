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

const app = express();

// Apply security headers
app.use(helmet());

// Configure CORS
const allowedOrigin = process.env.ALLOWED_ORIGIN;
if (!allowedOrigin) {
  console.warn('WARNING: ALLOWED_ORIGIN environment variable is not defined.');
}

app.use(cors({
  origin: allowedOrigin || '',
  credentials: true,
}));

// Apply global rate limiter (100 requests per 15 minutes per IP)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
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

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'NimbusFS Server is healthy.' });
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
    app.listen(PORT, () => {
      console.log(`Server is listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('CRITICAL ERROR: Failed to connect to MongoDB on startup. Exiting.');
    console.error(error);
    process.exit(1);
  });
