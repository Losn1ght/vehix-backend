import { Router, Request, Response } from 'express';
import { requireAuth } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/roleMiddleware';
import { validate } from '../middlewares/validate';
import { createUserSchema, resetPasswordSchema } from '../schemas/users';
import { userIdParamSchema } from '../schemas/common';
import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../lib/logger';

const router = Router();

// POST /api/users — Create a new user (admin only)
router.post('/users', requireAuth, requireRole('admin'), validate(createUserSchema), async (req: Request, res: Response) => {
  if (!supabaseAdmin) {
    res.status(500).json({ error: 'Admin client not configured. Set SUPABASE_SERVICE_ROLE_KEY.' });
    return;
  }

  // Body already validated by Zod — safe to destructure
  const { email, password, firstName, lastName, phoneNumber, roleId } = req.body;

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      logger.error('Create auth user error: ' + authError.message);
      res.status(400).json({ error: 'Failed to create user' });
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
      logger.error('Create user profile error: ' + profileError.message);
      res.status(400).json({ error: 'Failed to create user profile' });
      return;
    }

    res.status(201).json({ user: profile });
  } catch (err) {
    logger.error('Create user error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users/:userId/reset-password — Admin reset a user's password
router.post('/users/:userId/reset-password', requireAuth, requireRole('admin'), validate(userIdParamSchema, 'params'), validate(resetPasswordSchema), async (req: Request, res: Response) => {
  if (!supabaseAdmin) {
    res.status(500).json({ error: 'Admin client not configured. Set SUPABASE_SERVICE_ROLE_KEY.' });
    return;
  }

  const userId = req.params.userId as string;
  const { password } = req.body;

  try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });

    if (error) {
      logger.error('Reset password admin error: ' + error.message);
      res.status(400).json({ error: 'Failed to reset password' });
      return;
    }

    res.json({ message: 'Password reset successfully.' });
  } catch (err) {
    logger.error('Reset password error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users/:userId/archive — Soft-delete (archive) a user (admin only)
router.post('/users/:userId/archive', requireAuth, requireRole('admin'), validate(userIdParamSchema, 'params'), async (req: Request, res: Response) => {
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
      logger.error('Archive user profile error: ' + archiveError.message);
      res.status(400).json({ error: 'Failed to archive user' });
      return;
    }

    // 2. Ban the auth user so they can't log in
    const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: '876000h',
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

// POST /api/users/:userId/restore — Restore an archived user (admin only)
router.post('/users/:userId/restore', requireAuth, requireRole('admin'), validate(userIdParamSchema, 'params'), async (req: Request, res: Response) => {
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
      logger.error('Restore user profile error: ' + restoreError.message);
      res.status(400).json({ error: 'Failed to restore user' });
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
