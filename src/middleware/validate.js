import { z } from 'zod';

export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse({
    body: req.body,
    query: req.query,
    params: req.params,
  });

  if (!result.success) {
    const errorDetails = result.error.issues.map((err) => ({
      path: err.path.join('.'),
      message: err.message,
    }));
    return res.status(400).json({ error: 'Validation failed', details: errorDetails });
  }

  // Assign parsed and validated data back to request properties safely
  if (result.data.body) {
    req.body = result.data.body;
  }
  if (result.data.query) {
    for (const key of Object.keys(req.query)) {
      delete req.query[key];
    }
    Object.assign(req.query, result.data.query);
  }
  if (result.data.params) {
    for (const key of Object.keys(req.params)) {
      delete req.params[key];
    }
    Object.assign(req.params, result.data.params);
  }
  next();
};

// 1. Auth Schemas
export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
    email: z.string().email('Please provide a valid email address'),
    password: z.string()
      .min(8, 'Password must be at least 8 characters long')
      .regex(/[0-9]/, 'Password must contain at least one number'),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Please provide a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters long'),
  }),
});

// 2. Share Schemas
export const shareFileSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid file ID'),
  }),
  body: z.object({
    expiresIn: z.enum(['1h', '1d', '7d']).nullable().optional(),
    maxDownloads: z.number().int().positive().nullable().optional(),
    password: z.string().max(128).nullable().optional(),
  }),
});

// 3. Chunk schemas
export const initChunkSchema = z.object({
  body: z.object({
    originalName: z.string().min(1),
    mimeType: z.string().min(1),
    totalSize: z.number().int().positive(),
    totalChunks: z.number().int().min(1).max(100),
  }),
});

export const uploadChunkSchema = z.object({
  body: z.object({
    uploadId: z.string().length(21).regex(/^[a-zA-Z0-9_-]+$/),
    chunkIndex: z.union([z.number(), z.string()]).transform((val) => typeof val === 'string' ? parseInt(val, 10) : val).pipe(z.number().int().nonnegative()),
  }).catchall(z.any()),
});

export const completeChunkSchema = z.object({
  body: z.object({
    uploadId: z.string().length(21).regex(/^[a-zA-Z0-9_-]+$/),
    totalChunks: z.union([z.number(), z.string()]).transform((val) => typeof val === 'string' ? parseInt(val, 10) : val).pipe(z.number().int().min(1).max(100)),
  }).catchall(z.any()),
});

// 4. Pagination
export const paginationSchema = z.object({
  query: z.object({
    page: z.string().optional().transform((val) => val ? parseInt(val, 10) : 1).pipe(z.number().int().positive()),
    limit: z.string().optional().transform((val) => val ? parseInt(val, 10) : 20).pipe(z.number().int().positive().max(100)),
  }).catchall(z.any()),
});

// 5. Admin Failures
export const adminFailuresSchema = z.object({
  query: z.object({
    page: z.string().optional().transform((val) => val ? parseInt(val, 10) : 1).pipe(z.number().int().positive()),
    limit: z.string().optional().transform((val) => val ? parseInt(val, 10) : 20).pipe(z.number().int().positive().max(100)),
    provider: z.enum(['cloudinary', 'supabase', 'local']).optional(),
    operation: z.enum(['upload', 'download', 'delete', 'healthCheck']).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  }).catchall(z.any()),
});
