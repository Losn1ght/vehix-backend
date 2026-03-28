import { z } from 'zod';

export const notificationQuerySchema = z.object({
  is_read: z.coerce.boolean().optional(),
  target_role: z.enum(['admin', 'staff', 'customer', 'admin_staff']).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
