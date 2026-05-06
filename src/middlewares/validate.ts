import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError, ZodIssue } from 'zod';

/**
 * Validation middleware factory.
 * Validates req.body, req.query, or req.params against a Zod schema.
 *
 * Usage: validate(mySchema)           — validates req.body (default)
 *        validate(mySchema, 'query')  — validates req.query
 *        validate(mySchema, 'params') — validates req.params
 */
export const validate = (schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const errors = formatZodError(result.error);
      res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
      return;
    }

    // Replace with parsed (coerced/defaulted) values
    if (source === 'body') req.body = result.data;
    else if (source === 'query') (req as any).validatedQuery = result.data;
    else if (source === 'params') (req as any).validatedParams = result.data;

    next();
  };
};

function formatZodError(error: ZodError): { field: string; message: string }[] {
  return error.issues.map((issue: ZodIssue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}
