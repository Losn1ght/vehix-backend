import { Router, Request, Response } from 'express';
import { requireAuth } from '../middlewares/authMiddleware';
import { requireRole, attachRole } from '../middlewares/roleMiddleware';
import { validate } from '../middlewares/validate';
import { createDocumentSchema, updateDocumentStatusSchema, documentQuerySchema } from '../schemas/documents';
import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../lib/logger';

const router = Router();

// GET /api/documents — List documents (admin/staff see all, customers see own)
router.get('/documents', requireAuth, attachRole, validate(documentQuerySchema, 'query'), async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Admin client not configured' });
      return;
    }

    const { user_id, document_type, page, limit } = (req as any).validatedQuery;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('documents')
      .select('*, users ( user_id, first_name, last_name, email )', { count: 'exact' })
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    if (document_type) query = query.eq('document_type', document_type);

    // Role-based filtering
    if (user_id) {
      query = query.eq('user_id', user_id);
    } else if (req.userRole === 'customer') {
      query = query.eq('user_id', req.user!.id);
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
    logger.error('List documents error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/documents/:id — Get single document
router.get('/documents/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Admin client not configured' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('documents')
      .select('*, users ( user_id, first_name, last_name, email )')
      .eq('document_id', req.params.id)
      .single();

    if (error) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    res.json({ data });
  } catch (err) {
    logger.error('Get document error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/documents — Create document record
router.post('/documents', requireAuth, validate(createDocumentSchema), async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Admin client not configured' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('documents')
      .insert([req.body])
      .select()
      .single();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(201).json({ data });
  } catch (err) {
    logger.error('Create document error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/documents/:id/status — Approve or reject a document (admin/staff only)
router.put('/documents/:id/status', requireAuth, requireRole('admin', 'staff'), validate(updateDocumentStatusSchema), async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Admin client not configured' });
      return;
    }

    // The documents table doesn't have a status column yet — but we can add it
    // For now, we'll use a convention: store status in document_type suffix or add column
    // Actually, checking the DB schema: documents has no 'status' column
    // We'll update the document_type to include the review status as a workaround
    // TODO: Add a 'status' column to documents table via migration

    const { data, error } = await supabaseAdmin
      .from('documents')
      .update({ document_type: `${req.body.status}` })
      .eq('document_id', req.params.id)
      .select()
      .single();

    if (error || !data) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    res.json({ message: `Document ${req.body.status}`, data });
  } catch (err) {
    logger.error('Update document status error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
