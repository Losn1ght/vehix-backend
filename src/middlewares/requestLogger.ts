import pinoHttp from 'pino-http';
import { logger } from '../lib/logger';
import type { Request } from 'express';

/**
 * Structured HTTP request logger (pino-http).
 * Logs method, URL, status, duration, client IP, and authenticated user ID.
 * Registered early so every request is observed, but AFTER helmet/cors so
 * rejected preflights/headers-only responses don't produce noise.
 */
export const requestLogger = pinoHttp({
  logger,
  customProps: (req) => {
    const r = req as Request;
    return {
      ip: r.ip,
      userId: r.user?.id,
      role: r.userRole,
    };
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  customErrorMessage: (req, res, err) => `${req.method} ${req.url} ${res.statusCode}: ${err.message}`,
  serializers: {
    req: (req) => ({ method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});
