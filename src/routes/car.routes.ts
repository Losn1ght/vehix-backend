import { Router } from 'express';
import { createCarController } from '../controllers/car.controller';

const router = Router();

// POST /api/cars
router.post('/', createCarController);

export default router;