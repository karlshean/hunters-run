import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface CachedResponse {
  statusCode: number;
  data: any;
  timestamp: number;
  headers: Record<string, string>;
}

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  private static cache = new Map<string, CachedResponse>();
  private static readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly MAX_CACHE_SIZE = 10000;

  use(req: Request, res: Response, next: NextFunction) {
    const method = req.method;
    
    // Only apply to POST and PATCH requests
    if (!['POST', 'PATCH'].includes(method)) {
      return next();
    }
    
    const idempotencyKey = req.headers['idempotency-key'] as string;
    
    if (!idempotencyKey) {
      // Idempotency key is optional but recommended
      return next();
    }
    
    // Validate idempotency key format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(idempotencyKey)) {
      throw new BadRequestException({
        success: false,
        code: 'IDEMPOTENCY-KEY-INVALID',
        message: 'Idempotency-Key must be a valid UUID format',
        meta: {
          requestId: (req as any).requestId,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Create cache key (include organization for isolation)
    const orgId = req.headers['x-org-id'] as string;
    const cacheKey = `${orgId}:${method}:${req.path}:${idempotencyKey}`;
    
    // Check if we have a cached response
    const cached = IdempotencyMiddleware.cache.get(cacheKey);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      
      if (age < IdempotencyMiddleware.CACHE_TTL) {
        console.log(`🔄 Idempotency cache hit: ${idempotencyKey}`);
        
        // Set cached headers
        Object.entries(cached.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
        
        // Add idempotency info
        res.setHeader('x-idempotency-cached', 'true');
        res.setHeader('x-idempotency-age', age.toString());
        
        return res.status(cached.statusCode).json(cached.data);
      } else {
        // Expired cache entry
        IdempotencyMiddleware.cache.delete(cacheKey);
      }
    }
    
    // Cache the response
    const originalSend = res.send;
    const originalJson = res.json;
    
    res.send = function(data) {
      IdempotencyMiddleware.cacheResponse(cacheKey, res.statusCode, data, res.getHeaders());
      return originalSend.call(this, data);
    };
    
    res.json = function(data) {
      IdempotencyMiddleware.cacheResponse(cacheKey, res.statusCode, data, res.getHeaders());
      return originalJson.call(this, data);
    };
    
    console.log(`🆕 New idempotent request: ${idempotencyKey}`);
    next();
  }
  
  private static cacheResponse(key: string, statusCode: number, data: any, headers: any) {
    // Only cache successful responses
    if (statusCode >= 200 && statusCode < 300) {
      // Clean old entries if cache is full
      if (this.cache.size >= this.MAX_CACHE_SIZE) {
        const oldestKey = this.cache.keys().next().value;
        this.cache.delete(oldestKey);
      }
      
      this.cache.set(key, {
        statusCode,
        data,
        timestamp: Date.now(),
        headers: {
          'content-type': headers['content-type'] || 'application/json',
          'x-request-id': headers['x-request-id']
        }
      });
      
      console.log(`💾 Cached idempotent response: ${key}`);
    }
  }
  
  static getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      ttlMs: this.CACHE_TTL
    };
  }
  
  static clearCache() {
    this.cache.clear();
  }
}