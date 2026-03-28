import { z } from 'zod';

export const createMaintenanceSchema = z.object({
  car_id: z.string().uuid('Invalid car ID'),
  schedule_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  service_type: z.string().min(1, 'Service type is required'),
  description: z.string().optional().default(''),
  cost: z.number().min(0).optional(),
  performed_by: z.string().optional().default(''),
  date_performed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').nullable().optional().default(null),
});

export const updateMaintenanceSchema = createMaintenanceSchema.partial();

export const maintenanceQuerySchema = z.object({
  car_id: z.string().uuid().optional(),
  service_type: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
