import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

/**
 * Logs every request: method, path, status code, and response time in ms.
 * Must be registered early in the middleware stack.
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  // Hook into response finish event
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const level = statusCode >= 400 ? 'warn' : 'info';

    logger[level](`${req.method} ${req.originalUrl} ${statusCode} ${duration}ms`);
  });

  next();
};
