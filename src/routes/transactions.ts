import { Router, Request, Response } from 'express';
import { requireAuth } from '../middlewares/authMiddleware';
import { attachRole } from '../middlewares/roleMiddleware';
import { validate } from '../middlewares/validate';
import { transactionQuerySchema } from '../schemas/transactions';
import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../lib/logger';

const router = Router();

// GET /api/transactions — List transactions (admin/staff see all, customers see own)
router.get('/transactions', requireAuth, attachRole, validate(transactionQuerySchema, 'query'), async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Admin client not configured' });
      return;
    }

    const { reservation_id, user_id, payment_status, payment_method, page, limit } = (req as any).validatedQuery;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('transactions')
      .select('*, reservations ( reservation_id, status, car_id ), users ( user_id, first_name, last_name, email )', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (reservation_id) query = query.eq('reservation_id', reservation_id);
    if (payment_status) query = query.eq('payment_status', payment_status);
    if (payment_method) query = query.eq('payment_method', payment_method);

    // Customers always scoped to own data — ignore query param user_id
    if (req.userRole === 'customer') {
      query = query.eq('user_id', req.user!.id);
    } else if (user_id) {
      query = query.eq('user_id', user_id);
    }

    const { data, error, count } = await query;

    if (error) {
      res.status(400).json({ error: error.message });
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
    logger.error('List transactions error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/transactions/:id — Get single transaction
router.get('/transactions/:id', requireAuth, attachRole, async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Admin client not configured' });
      return;
    }

    let query = supabaseAdmin
      .from('transactions')
      .select('*, reservations ( reservation_id, status, car_id, rental_price ), users ( user_id, first_name, last_name, email )')
      .eq('transaction_id', req.params.id);

    // Customers can only view their own transactions
    if (req.userRole === 'customer') {
      query = query.eq('user_id', req.user!.id);
    }

    const { data, error } = await query.single();

    if (error) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    res.json({ data });
  } catch (err) {
    logger.error('Get transaction error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
