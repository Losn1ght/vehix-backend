import { z } from 'zod';

export const transactionQuerySchema = z.object({
  reservation_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  payment_status: z.enum(['completed', 'pending', 'failed', 'refunded']).optional(),
  payment_method: z.enum(['cash', 'gcash', 'bpi', 'bank_transfer']).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
