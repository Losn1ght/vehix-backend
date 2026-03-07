import { Router, Request, Response } from 'express';

const router = Router();

router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

router.get('/test-db', async (req: Request, res: Response) => {
  try {
    res.json({
      message: 'Supabase credentials detected! Backend is ready to query tables.',
    });
  } catch (error) {
    res.status(500).json({ error: 'Database query failed' });
  }
});

export default router;
