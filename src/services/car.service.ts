import { supabase } from './supabase.service';

export interface CreateCarInput {
  model: string;
  brand: string;
  plate_number: string;
  year?: number | undefined;
  capacity?: number | undefined;
  transmission?: string | undefined;
  fuel_type?: string | undefined;
  rate_per_day?: number | undefined;
  status?: string | undefined;
  current_mileage?: number | undefined;
  image?: string | undefined;
}

export async function createCar(input: CreateCarInput) {
  const {
    model,
    brand,
    plate_number,
    year,
    capacity,
    transmission,
    fuel_type,
    rate_per_day,
    status,
    current_mileage,
    image,
  } = input;

  const { data, error } = await supabase
    .from('car')
    .insert({
      model,
      brand,
      plate_number,
      year,
      capacity,
      transmission,
      fuel_type,
      rate_per_day,
      status,
      current_mileage,
      image,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
