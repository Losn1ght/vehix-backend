import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { supabase } from './lib/supabase';
import { requireAuth } from './middlewares/authMiddleware';

const app = express();
const port = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));
app.use(express.json());

// Rate limiting — 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

// A protected route
app.get('/api/protected', requireAuth, (req: Request, res: Response) => {
  res.json({ message: 'Welcome to the protected route!', user: req.user });
});

// Test the Supabase connection
app.get('/api/test-db', async (req: Request, res: Response) => {
  try {
    res.json({
      message: 'Supabase credentials detected! Backend is ready to query tables.',
    });
  } catch (error) {
    res.status(500).json({ error: 'Database query failed', details: error });
  }
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

// Graceful shutdown
function shutdown() {
  console.log('Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
