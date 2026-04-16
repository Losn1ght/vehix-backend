import { z } from 'zod';
import { strongPasswordSchema } from './common';

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: strongPasswordSchema,
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional().default(''),
  phoneNumber: z.string().optional().default(''),
  roleId: z.string().uuid('Invalid role ID').nullable().optional().default(null),
});

export const resetPasswordSchema = z.object({
  password: strongPasswordSchema,
});
