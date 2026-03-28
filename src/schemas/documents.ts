import { z } from 'zod';

export const createDocumentSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
  reservation_id: z.string().uuid('Invalid reservation ID').nullable().optional().default(null),
  transaction_id: z.string().uuid('Invalid transaction ID').nullable().optional().default(null),
  document_type: z.string().min(1, 'Document type is required'),
  image_url: z.string().url('Invalid image URL'),
});

export const updateDocumentStatusSchema = z.object({
  status: z.enum(['approved', 'rejected']),
});

export const documentQuerySchema = z.object({
  user_id: z.string().uuid().optional(),
  document_type: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
