import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { logger } from './lib/logger';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import healthRoutes from './routes/health';
import protectedRoutes from './routes/protected';
import userRoutes from './routes/users';

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

// Routes
app.use('/api', healthRoutes);
app.use('/api', protectedRoutes);
app.use('/api', userRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error: ' + err.message);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(port, () => {
  logger.info(`Server is running at http://localhost:${port}`);
});

// Graceful shutdown
function shutdown() {
  logger.info('Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
