import { z } from 'zod';

export const createVehicleSchema = z.object({
  model: z.string().min(1, 'Model is required'),
  brand: z.string().min(1, 'Brand is required'),
  plate_number: z.string().min(1, 'Plate number is required'),
  year: z.number().int().min(1900).max(2100).optional(),
  capacity: z.number().int().min(1).optional(),
  transmission: z.enum(['manual', 'automatic']).optional(),
  fuel_type: z.enum(['gasoline', 'diesel', 'electric', 'hybrid']).optional(),
  rate_per_day: z.number().positive('Rate must be positive').optional(),
  status: z.enum(['available', 'unavailable', 'maintenance']).optional().default('available'),
  current_mileage: z.number().int().min(0).optional(),
  image: z.string().url().optional(),
  type: z.string().optional(),
});

export const updateVehicleSchema = createVehicleSchema.partial();

export const vehicleQuerySchema = z.object({
  status: z.enum(['available', 'unavailable', 'maintenance']).optional(),
  type: z.string().optional(),
  transmission: z.enum(['manual', 'automatic']).optional(),
  fuel_type: z.enum(['gasoline', 'diesel', 'electric', 'hybrid']).optional(),
  min_capacity: z.coerce.number().int().min(1).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
