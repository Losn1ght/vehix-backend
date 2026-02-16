// src/services/user.service.ts
import { supabase } from './supabase.service';

export interface CreateUserInput {
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  address?: string;
  profile_photo?: string;
  password: string; // only for Auth signup
  role_id?: string | null;
  permission_id?: string | null;
}

export async function createUser(input: CreateUserInput) {
  const {
    first_name,
    last_name,
    email,
    phone_number,
    address,
    profile_photo,
    password,
    role_id = null,
    permission_id = null,
  } = input;

  console.log('[createUser] Starting signup for email:', email);

  // Create user in Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name,
        last_name,
        phone_number,
        address,
        profile_photo,
        role_id,
        permission_id,
      },
    },
  });

  if (authError || !authData.user) {
    console.error('[createUser] Failed to sign up in auth:', authError);
    throw new Error(
      `Failed to create user: ${authError?.message || 'User not created'}`,
    );
  }

  const authUserId = authData.user.id;
  console.log('[createUser] Auth user created with id:', authUserId);

  // Insert into public.users table
  const { data: userData, error: userError } = await supabase
    .from('users')
    .insert({
      user_id: authUserId, // FK to auth.users.id
      first_name,
      last_name,
      email,
      phone_number,
      address,
      profile_photo,
      role_id,
      permission_id,
    })
    .select()
    .single();

  if (userError) {
    console.error('[createUser] Error inserting into users table:', userError);

    // avoid orphaned auth users
    try {
      console.log('[createUser] Deleting auth user due to DB error');
      await supabase.auth.admin.deleteUser(authUserId);
    } catch (deleteErr) {
      console.error('[createUser] Failed to delete auth user:', deleteErr);
    }

    throw new Error(`Failed to create user in database: ${userError.message}`);
  }

  console.log('[createUser] User row created in users table:', userData);

  return userData;
}
