import 'dotenv/config';

export const PORT = parseInt(process.env.PORT, 10) || 5000;
export const MONGO_URI = process.env.MONGO_URI || '';
export const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';
export const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 10;
export const JWT_SECRET = process.env.JWT_SECRET || '';

export const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';
export const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '';
export const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || '';

export const SUPABASE_URL = process.env.SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
