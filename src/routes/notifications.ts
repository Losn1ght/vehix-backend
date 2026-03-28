import { Router, Request, Response } from 'express';
import { requireAuth } from '../middlewares/authMiddleware';
import { attachRole } from '../middlewares/roleMiddleware';
import { validate } from '../middlewares/validate';
import { notificationQuerySchema } from '../schemas/notifications';
import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../lib/logger';

const router = Router();

// GET /api/notifications — List notifications for the current user
router.get('/notifications', requireAuth, attachRole, validate(notificationQuerySchema, 'query'), async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Admin client not configured' });
      return;
    }

    const { is_read, target_role, page, limit } = (req as any).validatedQuery;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact' })
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    // Customers only see their own notifications
    if (req.userRole === 'customer') {
      query = query.eq('user_id', req.user!.id);
    } else {
      // Admin/staff see notifications targeted to them or their role
      query = query.or(`user_id.eq.${req.user!.id},target_role.eq.${req.userRole},target_role.eq.admin_staff`);
    }

    if (typeof is_read === 'boolean') query = query.eq('is_read', is_read);
    if (target_role) query = query.eq('target_role', target_role);

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
    logger.error('List notifications error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/notifications/:id/read — Mark single notification as read
router.put('/notifications/:id/read', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Admin client not configured' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('notif_id', req.params.id)
      .eq('user_id', req.user!.id)
      .select('notif_id')
      .single();

    if (error || !data) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    logger.error('Mark read error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/notifications/read-all — Mark all user's notifications as read
router.put('/notifications/read-all', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Admin client not configured' });
      return;
    }

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', req.user!.id)
      .eq('is_read', false);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    logger.error('Mark all read error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/notifications/:id — Delete a notification
router.delete('/notifications/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Admin client not configured' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('notif_id', req.params.id)
      .eq('user_id', req.user!.id)
      .select('notif_id')
      .single();

    if (error || !data) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    res.json({ message: 'Notification deleted' });
  } catch (err) {
    logger.error('Delete notification error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
