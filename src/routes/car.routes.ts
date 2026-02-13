import { Router } from 'express';
import { createCarController } from '../controllers/car.controller';
import { deleteCarController } from '../controllers/car.controller';

const router = Router();

// POST /api/car
router.post('/', createCarController);
router.delete('/:id', deleteCarController);

export default router;