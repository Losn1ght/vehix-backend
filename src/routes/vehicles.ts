import { Router, Request, Response } from 'express';
import { requireAuth } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/roleMiddleware';
import { validate } from '../middlewares/validate';
import { createVehicleSchema, updateVehicleSchema, vehicleQuerySchema } from '../schemas/vehicles';
import { uuidParamSchema } from '../schemas/common';
import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../lib/logger';
import { vehicleCache } from '../lib/cache';

const router = Router();

// GET /api/vehicles — List vehicles with optional filters and pagination
router.get('/vehicles', requireAuth, validate(vehicleQuerySchema, 'query'), async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Admin client not configured' });
      return;
    }

    const { status, type, transmission, fuel_type, min_capacity, page, limit } = (req as any).validatedQuery;
    const cacheKey = `list:${status || ''}:${type || ''}:${transmission || ''}:${fuel_type || ''}:${min_capacity || ''}:${page}:${limit}`;
    const cached = vehicleCache.get(cacheKey);
    if (cached) { res.json(cached); return; }

    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('car')
      .select('*', { count: 'exact' })
      .eq('archived', false)
      .order('vehicle_number', { ascending: true })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);
    if (type) query = query.eq('type', type);
    if (transmission) query = query.eq('transmission', transmission);
    if (fuel_type) query = query.eq('fuel_type', fuel_type);
    if (min_capacity) query = query.gte('capacity', min_capacity);

    const { data, error, count } = await query;

    if (error) {
      logger.error('List vehicles query error: ' + error.message);
      res.status(400).json({ error: 'Failed to list vehicles' });
      return;
    }

    const result = {
      data,
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    };
    vehicleCache.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    logger.error('List vehicles error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/vehicles/:id — Get single vehicle
router.get('/vehicles/:id', requireAuth, validate(uuidParamSchema, 'params'), async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Admin client not configured' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('car')
      .select('*')
      .eq('car_id', req.params.id)
      .eq('archived', false)
      .single();

    if (error) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    res.json({ data });
  } catch (err) {
    logger.error('Get vehicle error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/vehicles — Create vehicle (admin/staff only)
router.post('/vehicles', requireAuth, requireRole('admin', 'staff'), validate(createVehicleSchema), async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Admin client not configured' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('car')
      .insert([req.body])
      .select()
      .single();

    if (error) {
      logger.error('Create vehicle insert error: ' + error.message);
      res.status(400).json({ error: 'Failed to create vehicle' });
      return;
    }

    vehicleCache.clear();
    res.status(201).json({ data });
  } catch (err) {
    logger.error('Create vehicle error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/vehicles/:id — Update vehicle (admin/staff only)
router.put('/vehicles/:id', requireAuth, requireRole('admin', 'staff'), validate(uuidParamSchema, 'params'), validate(updateVehicleSchema), async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Admin client not configured' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('car')
      .update(req.body)
      .eq('car_id', req.params.id)
      .eq('archived', false)
      .select()
      .single();

    if (error) {
      logger.error('Update vehicle query error: ' + error.message);
      res.status(400).json({ error: 'Failed to update vehicle' });
      return;
    }

    if (!data) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    vehicleCache.clear();
    res.json({ data });
  } catch (err) {
    logger.error('Update vehicle error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/vehicles/:id — Archive vehicle (admin/staff only)
router.delete('/vehicles/:id', requireAuth, requireRole('admin', 'staff'), validate(uuidParamSchema, 'params'), async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Admin client not configured' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('car')
      .update({ archived: true })
      .eq('car_id', req.params.id)
      .eq('archived', false)
      .select('car_id')
      .single();

    if (error || !data) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }

    vehicleCache.clear();
    res.json({ message: 'Vehicle archived successfully' });
  } catch (err) {
    logger.error('Archive vehicle error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
