import { Request, Response, NextFunction } from 'express';
import { ZodObject, ZodError } from 'zod';

export const validate = (schema: ZodObject) => 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validates incoming data against the strict Zod rules
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Grab the very first validation mistake to keep messages clean
        const firstIssue = error.issues[0];
        
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: firstIssue.message,
            details: {
              field: firstIssue.path.slice(1).join('.') || firstIssue.path[0]
            }
          }
        });
      }

      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Erreur de validation interne' }
      });
    }
  };