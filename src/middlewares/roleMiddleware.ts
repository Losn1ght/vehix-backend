import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../lib/logger';

// Extend Express Request to include role info
declare global {
  namespace Express {
    interface Request {
      userRole?: string;
    }
  }
}

// ── Simple TTL cache for role lookups ────────────────────────────────────
// Avoids a DB round-trip on every authenticated request.
const ROLE_CACHE_TTL_MS = 60_000; // 60 seconds
const roleCache = new Map<string, { role: string; expiresAt: number }>();

function getCachedRole(userId: string): string | undefined {
  const entry = roleCache.get(userId);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    roleCache.delete(userId);
    return undefined;
  }
  return entry.role;
}

function setCachedRole(userId: string, role: string): void {
  roleCache.set(userId, { role, expiresAt: Date.now() + ROLE_CACHE_TTL_MS });
}

/** Call when a user's role changes (archive, restore, role update) to bust the cache. */
export function invalidateRoleCache(userId: string): void {
  roleCache.delete(userId);
}

// Helper: looks up the user's role and attaches it to req.userRole
async function lookupRole(req: Request): Promise<string | null> {
  if (!supabaseAdmin || !req.user) return null;

  // Check cache first
  const cached = getCachedRole(req.user.id);
  if (cached) return cached;

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('user_roles ( role_name )')
    .eq('user_id', req.user.id)
    .single();

  if (error || !data) {
    logger.error('Role lookup failed: ' + (error?.message || 'User not found'));
    return null;
  }

  // Supabase returns the join as an object (single FK) or array
  const userRoles = data.user_roles as unknown as { role_name: string } | { role_name: string }[] | null;
  const role = Array.isArray(userRoles) ? userRoles[0]?.role_name ?? null : userRoles?.role_name ?? null;

  if (role) setCachedRole(req.user.id, role);
  return role;
}

/**
 * Middleware that attaches the user's role to req.userRole without enforcing any specific role.
 * Use on routes that need role info for filtering logic (e.g. customers see only their own data).
 * Must be used AFTER requireAuth.
 */
export const attachRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    req.userRole = (await lookupRole(req)) ?? undefined;
    next();
  } catch (err) {
    logger.error('Attach role error: ' + (err instanceof Error ? err.message : String(err)));
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Middleware factory that checks if the authenticated user has one of the allowed roles.
 * Must be used AFTER requireAuth middleware (req.user must exist).
 *
 * Usage: requireRole('admin', 'staff')
 */
export const requireRole = (...allowedRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const roleName = await lookupRole(req);

      if (!roleName || !allowedRoles.includes(roleName)) {
        res.status(403).json({
          error: 'Forbidden',
          message: `This action requires one of: ${allowedRoles.join(', ')}`,
        });
        return;
      }

      req.userRole = roleName;
      next();
    } catch (err) {
      logger.error('Role middleware error: ' + (err instanceof Error ? err.message : String(err)));
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};
