import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export interface RequestWithId extends Request {
  requestId: string;
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: RequestWithId, res: Response, next: NextFunction) {
    // Generate or use existing request ID
    const requestId = req.headers['x-request-id'] as string || randomUUID();
    
    // Set on request object
    req.requestId = requestId;
    
    // Set response header
    res.setHeader('x-request-id', requestId);
    
    // Add to console logs (monkey patch for development)
    if (process.env.NODE_ENV === 'development') {
      const originalLog = console.log;
      const originalError = console.error;
      
      console.log = (...args) => originalLog(`[${requestId}]`, ...args);
      console.error = (...args) => originalError(`[${requestId}]`, ...args);
      
      // Restore after request
      res.on('finish', () => {
        console.log = originalLog;
        console.error = originalError;
      });
    }
    
    next();
  }
}