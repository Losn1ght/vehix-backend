import { Router, Request, Response } from 'express';
import { requireAuth } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/roleMiddleware';
import { validate } from '../middlewares/validate';
import { analyticsQuerySchema } from '../schemas/analytics';
import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../lib/logger';

const router = Router();

// GET /api/analytics/overview — KPI dashboard metrics (admin/staff only)
router.get('/analytics/overview', requireAuth, requireRole('admin', 'staff'), async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Admin client not configured' });
      return;
    }

    // Run all counts in parallel
    const [reservations, vehicles, users, transactions] = await Promise.all([
      supabaseAdmin.from('reservations').select('status', { count: 'exact', head: true }),
      supabaseAdmin.from('car').select('status', { count: 'exact', head: true }).eq('archived', false),
      supabaseAdmin.from('users').select('user_id', { count: 'exact', head: true }),
      supabaseAdmin.from('transactions').select('amount').eq('payment_status', 'completed'),
    ]);

    // Count reservations by status
    const [pending, active, completed, cancelled] = await Promise.all([
      supabaseAdmin.from('reservations').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabaseAdmin.from('reservations').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseAdmin.from('reservations').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabaseAdmin.from('reservations').select('*', { count: 'exact', head: true }).eq('status', 'cancelled'),
    ]);

    // Count vehicles by status
    const [available, inMaintenance] = await Promise.all([
      supabaseAdmin.from('car').select('*', { count: 'exact', head: true }).eq('archived', false).eq('status', 'available'),
      supabaseAdmin.from('car').select('*', { count: 'exact', head: true }).eq('archived', false).eq('status', 'maintenance'),
    ]);

    // Calculate total revenue
    const totalRevenue = (transactions.data || []).reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);

    res.json({
      data: {
        total_bookings: reservations.count ?? 0,
        bookings_by_status: {
          pending: pending.count ?? 0,
          active: active.count ?? 0,
          completed: completed.count ?? 0,
          cancelled: cancelled.count ?? 0,
        },
        total_vehicles: vehicles.count ?? 0,
        vehicles_by_status: {
          available: available.count ?? 0,
          maintenance: inMaintenance.count ?? 0,
        },
        total_users: users.count ?? 0,
        total_revenue: totalRevenue,
        total_transactions: transactions.data?.length ?? 0,
      },
    });
  } catch (err) {
    logger.error('Analytics overview error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/revenue — Revenue breakdown (admin/staff only)
router.get('/analytics/revenue', requireAuth, requireRole('admin', 'staff'), validate(analyticsQuerySchema, 'query'), async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Admin client not configured' });
      return;
    }

    const { start_date, end_date } = (req as any).validatedQuery;

    let query = supabaseAdmin
      .from('transactions')
      .select('amount, payment_method, payment_status, created_at')
      .eq('payment_status', 'completed')
      .order('created_at', { ascending: false });

    if (start_date) query = query.gte('created_at', start_date);
    if (end_date) query = query.lte('created_at', end_date + 'T23:59:59');

    const { data, error } = await query;

    if (error) {
      logger.error('Analytics revenue query error: ' + error.message);
      res.status(400).json({ error: 'Failed to load analytics' });
      return;
    }

    // Aggregate by payment method
    const byMethod: Record<string, number> = {};
    let total = 0;
    for (const t of data || []) {
      const method = t.payment_method || 'unknown';
      const amount = Number(t.amount) || 0;
      byMethod[method] = (byMethod[method] || 0) + amount;
      total += amount;
    }

    res.json({
      data: {
        total_revenue: total,
        transaction_count: data?.length ?? 0,
        by_payment_method: byMethod,
      },
    });
  } catch (err) {
    logger.error('Analytics revenue error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/fleet — Fleet utilization stats (admin/staff only)
router.get('/analytics/fleet', requireAuth, requireRole('admin', 'staff'), async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Admin client not configured' });
      return;
    }

    // Get all non-archived vehicles with their reservation counts
    const { data: vehicles, error: vErr } = await supabaseAdmin
      .from('car')
      .select('car_id, model, brand, plate_number, status, rate_per_day')
      .eq('archived', false)
      .order('vehicle_number', { ascending: true });

    if (vErr) {
      logger.error('Analytics fleet vehicle query error: ' + vErr.message);
      res.status(400).json({ error: 'Failed to load fleet analytics' });
      return;
    }

    // Get reservation counts per car
    const { data: resCounts, error: rcErr } = await supabaseAdmin
      .from('reservations')
      .select('car_id')
      .in('status', ['active', 'completed', 'pending']);

    if (rcErr) {
      logger.error('Analytics fleet reservation query error: ' + rcErr.message);
      res.status(400).json({ error: 'Failed to load fleet analytics' });
      return;
    }

    // Count bookings per car
    const bookingsPerCar: Record<string, number> = {};
    for (const r of resCounts || []) {
      bookingsPerCar[r.car_id] = (bookingsPerCar[r.car_id] || 0) + 1;
    }

    // Get maintenance counts per car
    const { data: maintCounts } = await supabaseAdmin
      .from('maintenance')
      .select('car_id')
      .eq('archived', false);

    const maintenancePerCar: Record<string, number> = {};
    for (const m of maintCounts || []) {
      maintenancePerCar[m.car_id] = (maintenancePerCar[m.car_id] || 0) + 1;
    }

    const fleetData = (vehicles || []).map((v: any) => ({
      car_id: v.car_id,
      model: v.model,
      brand: v.brand,
      plate_number: v.plate_number,
      status: v.status,
      rate_per_day: v.rate_per_day,
      total_bookings: bookingsPerCar[v.car_id] || 0,
      total_maintenance: maintenancePerCar[v.car_id] || 0,
    }));

    res.json({ data: fleetData });
  } catch (err) {
    logger.error('Analytics fleet error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
