import { NextFunction, Request, Response } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError } from '../utils/response.util';

export function validate(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        params: req.params,
        query: req.query,
      });

      // Merge parsed (coerced/defaulted) values back into req
      if (parsed.body !== undefined) req.body = parsed.body;
      if (parsed.params !== undefined) req.params = parsed.params;
      if (parsed.query !== undefined) req.query = parsed.query;

      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.errors.map((e) => ({
          field: e.path.filter((p) => p !== 'body' && p !== 'params' && p !== 'query').join('.'),
          message: e.message,
        }));
        sendError(res, 'Validation failed', 400, errors);
        return;
      }
      next(err);
    }
  };
}
