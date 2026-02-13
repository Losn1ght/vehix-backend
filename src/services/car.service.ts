import { supabase } from './supabase.service';

// Define the input type for creating a car
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

// Service function to create a new car

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

// Service function to delete a car by ID
export async function deleteCar(id: string) {
  const { data, error } = await supabase
    .from('car')
    .delete()
    .eq('car_id', id)
    .select()
    .single();

  if (error) {
    //PGRST116 is the error code for "Row not found" in PostgREST, which Supabase uses under the hood
    if ((error as any).code === 'PGRST116') {
      // Row not found
      const notFound = new Error('Car not found');
      (notFound as any).status = 404;
      throw notFound;
    }

    throw error;
  }

  return data;
}
