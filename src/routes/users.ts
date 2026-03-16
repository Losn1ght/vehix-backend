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
    // 1. Create the auth user
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

// POST /api/users/:userId/archive — Soft-delete (archive) a user
router.post('/users/:userId/archive', requireAuth, async (req: Request, res: Response) => {
  if (!supabaseAdmin) {
    res.status(500).json({ error: 'Admin client not configured. Set SUPABASE_SERVICE_ROLE_KEY.' });
    return;
  }

  const userId = req.params.userId as string;

  try {
    // 1. Set archived_at timestamp on public profile
    const { error: archiveError } = await supabaseAdmin
      .from('users')
      .update({ archived_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (archiveError) {
      res.status(400).json({ error: archiveError.message });
      return;
    }

    // 2. Ban the auth user so they can't log in
    const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: 'none',
      user_metadata: { archived: true },
    });

    // Ban is best-effort — profile archival is the source of truth
    if (banError) {
      logger.error('Failed to ban archived user: ' + banError.message);
    }

    res.json({ message: 'User archived successfully.' });
  } catch (err) {
    logger.error('Archive user error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users/:userId/restore — Restore an archived user
router.post('/users/:userId/restore', requireAuth, async (req: Request, res: Response) => {
  if (!supabaseAdmin) {
    res.status(500).json({ error: 'Admin client not configured. Set SUPABASE_SERVICE_ROLE_KEY.' });
    return;
  }

  const userId = req.params.userId as string;

  try {
    // 1. Clear archived_at on public profile
    const { error: restoreError } = await supabaseAdmin
      .from('users')
      .update({ archived_at: null })
      .eq('user_id', userId);

    if (restoreError) {
      res.status(400).json({ error: restoreError.message });
      return;
    }

    // 2. Unban the auth user
    const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: 'none',
      user_metadata: { archived: false },
    });

    if (unbanError) {
      logger.error('Failed to unban restored user: ' + unbanError.message);
    }

    res.json({ message: 'User restored successfully.' });
  } catch (err) {
    logger.error('Restore user error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
