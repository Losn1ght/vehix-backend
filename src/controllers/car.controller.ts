import { Request, Response, NextFunction } from 'express';
import { createCar, CreateCarInput } from '../services/car.service';

export async function createCarController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const body = req.body as Partial<CreateCarInput>;

    if (!body.brand || !body.model || !body.plate_number) {
      return res.status(400).json({ error: 'brand, model, and plate_number are required' });
    }

    const newCar = await createCar({
      model: body.model,
      brand: body.brand,
      plate_number: body.plate_number,
      year: body.year,
      capacity: body.capacity,
      transmission: body.transmission,
      fuel_type: body.fuel_type,
      rate_per_day: body.rate_per_day,
      status: body.status,
      current_mileage: body.current_mileage,
      image: body.image,
    });

    return res.status(201).json(newCar);
  } catch (err) {
    next(err);
  }
}
