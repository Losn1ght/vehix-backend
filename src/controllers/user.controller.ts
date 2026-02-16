import { Request, Response, NextFunction } from 'express';
import { createUser } from '../services/user.service';

export async function createUserController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const {
      first_name,
      last_name,
      email,
      phone_number,
      address,
      profile_photo,
      password,
      role_id,
      permission_id,
    } = req.body;

    const user = await createUser({
      first_name,
      last_name,
      email,
      phone_number,
      address,
      profile_photo,
      password,
      role_id,
      permission_id,
    });

    console.log('User created successfully:', user);
    res.status(201).json({ user });
  } catch (error) {
    console.error('Error creating user:', error);
    next(error);
  }
}
