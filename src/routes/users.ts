import { Router, Request, Response } from 'express';
import { requireAuth } from '../middlewares/authMiddleware';
import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../lib/logger';

const router = Router();

// POST /api/users — Create a new user (auth + public profile)
router.post('/users', requireAuth, async (req: Request, res: Response) => {
  if (!supabaseAdmin) {
    res.status(500).json({ error: 'Admin client not configured. Set SUPABASE_SERVICE_ROLE_KEY.' });
    return;
  }

  const { email, password, firstName, lastName, phoneNumber, roleId } = req.body;

  if (!email || !password || !firstName) {
    res.status(400).json({ error: 'email, password, and firstName are required.' });
    return;
  }

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      res.status(400).json({ error: authError.message });
      return;
    }

    // 2. Insert public.users profile row (use admin client to bypass RLS)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .insert([{
        user_id: authData.user.id,
        email,
        first_name: firstName,
        last_name: lastName || '',
        phone_number: phoneNumber || '',
        role_id: roleId || null,
      }])
      .select(`user_id, email, first_name, last_name, phone_number, created_at, user_roles ( role_name )`)
      .single();

    if (profileError) {
      // Clean up the orphaned auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      res.status(400).json({ error: profileError.message });
      return;
    }

    res.status(201).json({ user: profile });
  } catch (err) {
    logger.error('Create user error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users/:userId/reset-password — Admin reset a user's password
router.post('/users/:userId/reset-password', requireAuth, async (req: Request, res: Response) => {
  if (!supabaseAdmin) {
    res.status(500).json({ error: 'Admin client not configured. Set SUPABASE_SERVICE_ROLE_KEY.' });
    return;
  }

  const userId = req.params.userId as string;
  const { password } = req.body;

  if (!password) {
    res.status(400).json({ error: 'password is required.' });
    return;
  }

  try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ message: 'Password reset successfully.' });
  } catch (err) {
    logger.error('Reset password error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/users/:userId — Soft-delete a user (admin only)
//
// TEAM DEPENDENCY: This route requires the `status` column on the `users` table.
// Run this migration before using this endpoint:
//   ALTER TABLE users ADD COLUMN status text NOT NULL DEFAULT 'active';
// Without it, the UPDATE will fail and this route returns 400 with the DB error message.
//
// This does NOT remove the row or the auth user. It sets status = 'deleted',
// which the frontend reads to show the user as deactivated.
router.delete('/users/:userId', requireAuth, async (req: Request, res: Response) => {
  if (!supabaseAdmin) {
    res.status(500).json({ error: 'Admin client not configured. Set SUPABASE_SERVICE_ROLE_KEY.' });
    return;
  }

  const targetId = req.params.userId as string;
  const callerId = (req.user as { id: string }).id;

  try {
    const { data: callerProfile } = await supabaseAdmin
      .from('users')
      .select('user_roles ( role_name )')
      .eq('user_id', callerId)
      .single();

    const roleData = Array.isArray(callerProfile?.user_roles)
      ? callerProfile?.user_roles[0]
      : callerProfile?.user_roles;
    const callerRole = (roleData as { role_name?: string } | null)?.role_name;

    if (callerRole !== 'admin') {
      res.status(403).json({ error: 'Admin access required.' });
      return;
    }

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ status: 'deleted' })
      .eq('user_id', targetId);

    if (updateError) {
      // Surfaces the DB error clearly — likely the status column doesn't exist yet
      res.status(400).json({ error: updateError.message });
      return;
    }

    res.json({ message: 'User deactivated successfully.' });
  } catch (err) {
    logger.error('Delete user error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
