import { Router, Request, Response } from 'express';
import { requireAuth } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/roleMiddleware';
import { validate } from '../middlewares/validate';
import { createMaintenanceSchema, updateMaintenanceSchema, maintenanceQuerySchema } from '../schemas/maintenance';
import { uuidParamSchema } from '../schemas/common';
import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../lib/logger';

const router = Router();

// GET /api/maintenance — List maintenance records with filters and pagination
router.get('/maintenance', requireAuth, requireRole('admin', 'staff'), validate(maintenanceQuerySchema, 'query'), async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Admin client not configured' });
      return;
    }

    const { car_id, service_type, page, limit } = (req as any).validatedQuery;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('maintenance')
      .select('*, car ( car_id, model, brand, plate_number )', { count: 'exact' })
      .eq('archived', false)
      .order('schedule_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (car_id) query = query.eq('car_id', car_id);
    if (service_type) query = query.ilike('service_type', `%${service_type}%`);

    const { data, error, count } = await query;

    if (error) {
      logger.error('List maintenance query error: ' + error.message);
      res.status(400).json({ error: 'Failed to list maintenance records' });
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
    logger.error('List maintenance error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/maintenance/:id — Get single maintenance record
router.get('/maintenance/:id', requireAuth, requireRole('admin', 'staff'), validate(uuidParamSchema, 'params'), async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Admin client not configured' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('maintenance')
      .select('*, car ( * )')
      .eq('maintenance_id', req.params.id)
      .eq('archived', false)
      .single();

    if (error) {
      res.status(404).json({ error: 'Maintenance record not found' });
      return;
    }

    res.json({ data });
  } catch (err) {
    logger.error('Get maintenance error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/maintenance — Create maintenance record (admin/staff only)
router.post('/maintenance', requireAuth, requireRole('admin', 'staff'), validate(createMaintenanceSchema), async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Admin client not configured' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('maintenance')
      .insert([req.body])
      .select('*, car ( car_id, model, brand, plate_number )')
      .single();

    if (error) {
      logger.error('Create maintenance insert error: ' + error.message);
      res.status(400).json({ error: 'Failed to create maintenance record' });
      return;
    }

    res.status(201).json({ data });
  } catch (err) {
    logger.error('Create maintenance error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/maintenance/:id — Update maintenance record (admin/staff only)
router.put('/maintenance/:id', requireAuth, requireRole('admin', 'staff'), validate(uuidParamSchema, 'params'), validate(updateMaintenanceSchema), async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Admin client not configured' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('maintenance')
      .update(req.body)
      .eq('maintenance_id', req.params.id)
      .eq('archived', false)
      .select('*, car ( car_id, model, brand, plate_number )')
      .single();

    if (error) {
      logger.error('Update maintenance query error: ' + error.message);
      res.status(400).json({ error: 'Failed to update maintenance record' });
      return;
    }

    if (!data) {
      res.status(404).json({ error: 'Maintenance record not found' });
      return;
    }

    res.json({ data });
  } catch (err) {
    logger.error('Update maintenance error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/maintenance/:id — Archive maintenance record (admin/staff only)
router.delete('/maintenance/:id', requireAuth, requireRole('admin', 'staff'), validate(uuidParamSchema, 'params'), async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Admin client not configured' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('maintenance')
      .update({ archived: true })
      .eq('maintenance_id', req.params.id)
      .eq('archived', false)
      .select('maintenance_id')
      .single();

    if (error || !data) {
      res.status(404).json({ error: 'Maintenance record not found' });
      return;
    }

    res.json({ message: 'Maintenance record archived' });
  } catch (err) {
    logger.error('Archive maintenance error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
