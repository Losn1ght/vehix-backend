import 'dotenv/config';
import './lib/env'; // Validate env vars before anything else
import express, { Request, Response, NextFunction } from 'express';
import { logger } from './lib/logger';
import cors from 'cors';
import helmet from 'helmet';
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

// Request logging
app.use(requestLogger);

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
app.use('/api', vehicleRoutes);
app.use('/api', reservationRoutes);
app.use('/api', transactionRoutes);
app.use('/api', notificationRoutes);
app.use('/api', documentRoutes);
app.use('/api', maintenanceRoutes);
app.use('/api', analyticsRoutes);

// Swagger API docs
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error: ' + err.message);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
