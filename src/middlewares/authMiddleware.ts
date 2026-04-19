import { Request, Response, NextFunction } from 'express';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

function getJwtExpiry(token: string): number | null {
  const [, payload] = token.split('.');
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(Buffer.from(normalized, 'base64').toString('utf8')) as { exp?: unknown };
    return typeof decoded.exp === 'number' ? decoded.exp : null;
  } catch {
    return null;
  }
}

function isExpiredTokenError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const message = 'message' in error && typeof error.message === 'string' ? error.message.toLowerCase() : '';
  return message.includes('expired') || message.includes('jwt expired');
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
       res.status(401).json({ error: 'Missing or malformed Authorization header' });
       return;
    }

    const token = authHeader.split(' ')[1];
    const expiresAt = getJwtExpiry(token);
    if (expiresAt && expiresAt <= Math.floor(Date.now() / 1000)) {
       res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
       return;
    }

    // Verify the JWT with Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
       if (isExpiredTokenError(error)) {
         res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
         return;
       }
       res.status(401).json({ error: 'Authentication failed' });
       return;
    }

    // Attach the auth user to the Request
    req.user = user;
    next();
  } catch (error) {
    logger.error('Auth Middleware Error: ' + (error instanceof Error ? error.message : String(error)));
    res.status(500).json({ error: 'Internal Server Error during authentication' });
  }
};
