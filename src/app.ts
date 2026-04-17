import 'dotenv/config';
import { env } from './lib/env'; // Validate env vars before anything else
import express, { Request, Response, NextFunction } from 'express';
import { logger } from './lib/logger';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import healthRoutes from './routes/health';
import protectedRoutes from './routes/protected';
import userRoutes from './routes/users';
import vehicleRoutes from './routes/vehicles';
import reservationRoutes from './routes/reservations';
import transactionRoutes from './routes/transactions';
import notificationRoutes from './routes/notifications';
import documentRoutes from './routes/documents';
import maintenanceRoutes from './routes/maintenance';
import analyticsRoutes from './routes/analytics';
import { requestLogger } from './middlewares/requestLogger';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './lib/swagger';

const app = express();

// Trust proxy (Next.js rewrites add X-Forwarded-For)
app.set('trust proxy', 1);

// Security middleware FIRST so rejected requests don't generate log noise
app.use(helmet());
app.use(compression());

// CORS — in production, only allow the configured origin; in dev allow localhost fallback
const allowedOrigins = env.isProduction
  ? [env.CORS_ORIGIN].filter(Boolean)
  : [env.CORS_ORIGIN, 'http://localhost:3000'].filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // Same-origin / server-to-server requests have no Origin header
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: '1mb' }));

// Cache-Control: disable caching on API responses by default
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// Request logging (runs after security so preflights/denied requests don't log as app traffic)
app.use(requestLogger);

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
app.use('/api', vehicleRoutes);
app.use('/api', reservationRoutes);
app.use('/api', transactionRoutes);
app.use('/api', notificationRoutes);
app.use('/api', documentRoutes);
app.use('/api', maintenanceRoutes);
app.use('/api', analyticsRoutes);

// Swagger API docs are useful locally but should not expose API internals in production.
if (!env.isProduction) {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler — never leak internals in production
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    error: env.isProduction ? 'Internal server error' : err.message,
  });
});

export default app;
