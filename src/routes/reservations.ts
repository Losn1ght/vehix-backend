import { Router, Request, Response } from 'express';
import { requireAuth } from '../middlewares/authMiddleware';
import { requireRole, attachRole } from '../middlewares/roleMiddleware';
import { validate } from '../middlewares/validate';
import {
  createReservationSchema,
  transitionStatusSchema,
  recordPaymentSchema,
  reservationQuerySchema,
} from '../schemas/reservations';
import { uuidParamSchema } from '../schemas/common';
import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../lib/logger';

const router = Router();

// GET /api/reservations — List reservations (admin/staff see all, customers see own)
router.get('/reservations', requireAuth, attachRole, validate(reservationQuerySchema, 'query'), async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Admin client not configured' });
      return;
    }

    const { status, user_id, car_id, page, limit } = (req as any).validatedQuery;
    const offset = (page - 1) * limit;

    // Use admin client (bypasses RLS). Apply role-based filtering in code:
    // - admin/staff see all reservations
    // - customers see only their own (enforced by filtering on user_id)
    let query = supabaseAdmin
      .from('reservations')
      .select('*, car ( car_id, model, brand, plate_number, image ), users ( user_id, first_name, last_name, email )', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);
    if (car_id) query = query.eq('car_id', car_id);

    // Customers always scoped to own data — ignore query param user_id
    if (req.userRole === 'customer') {
      query = query.eq('user_id', req.user!.id);
    } else if (user_id) {
      query = query.eq('user_id', user_id);
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error('List reservations query error: ' + error.message);
      res.status(400).json({ error: 'Failed to list reservations' });
      return;
    }

    res.json({
      data,
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    });
  } catch (err) {
    logger.error('List reservations error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reservations/:id — Get single reservation
router.get('/reservations/:id', requireAuth, attachRole, validate(uuidParamSchema, 'params'), async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Admin client not configured' });
      return;
    }

    let query = supabaseAdmin
      .from('reservations')
      .select('*, car ( * ), users ( user_id, first_name, last_name, email, phone_number )')
      .eq('reservation_id', req.params.id);

    // Customers can only view their own reservations
    if (req.userRole === 'customer') {
      query = query.eq('user_id', req.user!.id);
    }

    const { data, error } = await query.single();

    if (error) {
      res.status(404).json({ error: 'Reservation not found' });
      return;
    }

    res.json({ data });
  } catch (err) {
    logger.error('Get reservation error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/reservations — Create reservation(s) via DB function
router.post('/reservations', requireAuth, attachRole, validate(createReservationSchema), async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Admin client not configured' });
      return;
    }

    const { reservations, voucher_id } = req.body;

    // Customers can only create reservations for themselves
    if (req.userRole === 'customer') {
      for (const r of reservations) {
        r.user_id = req.user!.id;
      }
    }

    // Server-side overlap check before creating reservations
    for (const r of reservations) {
      const { data: conflicts } = await supabaseAdmin
        .from('reservations')
        .select('reservation_id')
        .eq('car_id', r.car_id)
        .in('status', ['pending', 'confirmed', 'booked', 'active'])
        .lte('start_date', r.end_date)
        .gte('end_date', r.start_date)
        .limit(1);

      if (conflicts && conflicts.length > 0) {
        res.status(409).json({
          error: 'Vehicle is already booked for the selected dates',
        });
        return;
      }
    }

    // Call the DB function create_booking_with_voucher
    // This atomically: creates reservations, calculates fees, increments voucher, generates DP reminders
    const { data, error } = await supabaseAdmin.rpc('create_booking_with_voucher', {
      p_reservations: reservations,
      p_voucher_id: voucher_id,
    });

    if (error) {
      logger.error('Create reservation RPC error: ' + error.message);
      res.status(400).json({ error: 'Failed to create reservation' });
      return;
    }

    res.status(201).json({
      message: 'Reservation(s) created successfully',
      reservation_ids: data,
    });
  } catch (err) {
    logger.error('Create reservation error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/reservations/:id/status — Transition booking status (admin/staff only)
router.put('/reservations/:id/status', requireAuth, requireRole('admin', 'staff'), validate(uuidParamSchema, 'params'), validate(transitionStatusSchema), async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Admin client not configured' });
      return;
    }

    const { new_status, rejection_reason } = req.body;

    // Call the DB function transition_booking_status
    const { error } = await supabaseAdmin.rpc('transition_booking_status', {
      p_reservation_id: req.params.id,
      p_new_status: new_status,
      p_rejection_reason: rejection_reason || null,
    });

    if (error) {
      logger.error('Transition status RPC error: ' + error.message);
      res.status(400).json({ error: 'Failed to update reservation status' });
      return;
    }

    res.json({
      message: `Reservation status updated to '${new_status}'`,
    });
  } catch (err) {
    logger.error('Transition status error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/reservations/:id/record-payment — Record down payment (admin/staff only)
router.post('/reservations/:id/record-payment', requireAuth, requireRole('admin', 'staff'), validate(uuidParamSchema, 'params'), validate(recordPaymentSchema), async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Admin client not configured' });
      return;
    }

    const { amount, payment_method, reference_number } = req.body;

    // Call the DB function record_down_payment
    const { error } = await supabaseAdmin.rpc('record_down_payment', {
      p_reservation_id: req.params.id,
      p_amount: amount,
      p_payment_method: payment_method,
      p_reference_number: reference_number || null,
    });

    if (error) {
      logger.error('Record payment RPC error: ' + error.message);
      res.status(400).json({ error: 'Failed to record payment' });
      return;
    }

    res.json({ message: 'Payment recorded successfully' });
  } catch (err) {
    logger.error('Record payment error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
