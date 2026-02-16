import express from 'express';
import cors from 'cors';
import carRoutes from './routes/car.routes';
import userRoutes from './routes/user.routes';
import { errorMiddleware } from './middlewares/error.middleware';

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/car', carRoutes);
app.use('/api/auth', userRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Error handler (last)
app.use(errorMiddleware);

export default app;
