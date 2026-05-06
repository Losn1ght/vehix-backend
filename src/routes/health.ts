import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';

const router = Router();

router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

router.get('/test-db', async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      res.status(500).json({ error: 'Admin client not configured' });
      return;
    }

    const { count, error } = await supabaseAdmin
      .from('car')
      .select('*', { count: 'exact', head: true });

    if (error) {
      res.status(500).json({ error: 'Database query failed' });
      return;
    }

    res.json({ status: 'ok', message: `Database connected. ${count} vehicles in fleet.` });
  } catch (error) {
    res.status(500).json({ error: 'Database query failed' });
  }
});

export default router;
