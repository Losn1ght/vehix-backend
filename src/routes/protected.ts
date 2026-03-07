import { Router, Request, Response } from 'express';
import { requireAuth } from '../middlewares/authMiddleware';

const router = Router();

router.get('/protected', requireAuth, (req: Request, res: Response) => {
  res.json({ message: 'Welcome to the protected route!', user: req.user });
});

export default router;
