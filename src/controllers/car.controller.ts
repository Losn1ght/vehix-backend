import { Request, Response, NextFunction } from 'express';
import { createCar, deleteCar, CreateCarInput } from '../services/car.service';

// A variable that can be used to validate UUIDs (if needed in the future)
const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Controller to handle creating a new car
export async function createCarController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = req.body as Partial<CreateCarInput>;

    if (!body.brand || !body.model || !body.plate_number) {
      return res
        .status(400)
        .json({ error: 'brand, model, and plate_number are required' });
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

    console.log('New car created successfully:', newCar);

    return res.status(201).json(newCar);
  } catch (err) {
    next(err);
  }
}

// Controller to handle deleting a car by ID
export async function deleteCarController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;

    if (!id || Array.isArray(id) || !uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Invalid car ID' });
    }

    const deleted = await deleteCar(id);

    console.log(`Car with ID ${id} deleted successfully:`, deleted);

    return res.status(200).json({
      message: `Car with ID ${id} deleted successfully`,
      data: deleted,
    });
  } catch (err: any) {
    if (err instanceof Error && err.message === 'Car not found') {
      return res.status(404).json({ error: err.message });
    }

    next(err);
  }
}
