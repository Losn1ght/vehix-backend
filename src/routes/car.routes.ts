import { Router } from 'express';
import {
  createCarController,
  deleteCarController,
  getCarController,
  updateCarController,
} from '../controllers/car.controller';
import {} from '../controllers/car.controller';

const router = Router();

// POST /api/car
router.get('/:id', getCarController);
router.post('/', createCarController);
router.delete('/:id', deleteCarController);
router.put('/:id', updateCarController);

export default router;
