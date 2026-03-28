import { z } from 'zod';

const reservationItemSchema = z.object({
  car_id: z.string().uuid('Invalid car ID'),
  user_id: z.string().uuid('Invalid user ID'),
  rental_price: z.number().positive('Rental price must be positive'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  start_time: z.string().optional().default(''),
  end_time: z.string().optional().default(''),
  pickup_location: z.string().optional().default(''),
  purpose: z.string().optional().default(''),
});

export const createReservationSchema = z.object({
  reservations: z.array(reservationItemSchema).min(1, 'At least one reservation required'),
  voucher_id: z.string().uuid('Invalid voucher ID').nullable().optional().default(null),
});

export const transitionStatusSchema = z.object({
  new_status: z.enum(['pending', 'active', 'completed', 'cancelled', 'rejected']),
  rejection_reason: z.string().optional().default(''),
});

export const recordPaymentSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  payment_method: z.enum(['cash', 'gcash', 'bpi', 'bank_transfer']).optional().default('cash'),
  reference_number: z.string().optional().default(''),
});

export const reservationQuerySchema = z.object({
  status: z.enum(['pending', 'active', 'completed', 'cancelled', 'rejected']).optional(),
  user_id: z.string().uuid().optional(),
  car_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
