import 'dotenv/config';

export const PORT = parseInt(process.env.PORT, 10) || 5000;
export const MONGO_URI = process.env.MONGO_URI || '';
export const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';
export const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 10;
export const JWT_SECRET = process.env.JWT_SECRET || '';
export const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || '';

export const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';
export const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '';
export const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || '';

export const SUPABASE_URL = process.env.SUPABASE_URL || '';
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'nimbusfs-files';

export const REDIS_URL = process.env.REDIS_URL || '';
export const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
export const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';
export const CHUNK_SIZE_KB = parseInt(process.env.CHUNK_SIZE_KB, 10) || 512;

// Run strict validation on startup
const requiredEnv = {
  MONGO_URI,
  JWT_SECRET,
  REFRESH_TOKEN_SECRET,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_BUCKET,
  REDIS_URL,
};

for (const [key, value] of Object.entries(requiredEnv)) {
  if (!value) {
    throw new Error(`CRITICAL ERROR: Environment variable '${key}' is not defined.`);
  }
}

// Validate ENCRYPTION_KEY format (64 hex characters represent 32 bytes)
if (!ENCRYPTION_KEY || !/^[0-9a-fA-F]{64}$/.test(ENCRYPTION_KEY)) {
  throw new Error("CRITICAL ERROR: 'ENCRYPTION_KEY' must be exactly 64 hex characters (32 bytes).");
}
