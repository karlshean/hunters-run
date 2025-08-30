import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';

// Security headers middleware
@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private helmetMiddleware = helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // For Swagger UI
        scriptSrc: ["'self'", "'unsafe-inline'"], // For Swagger UI
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    noSniff: true,
    frameguard: { action: 'deny' },
    xssFilter: true
  });

  use(req: Request, res: Response, next: NextFunction) {
    this.helmetMiddleware(req, res, next);
  }
}

// Compression middleware
@Injectable()
export class CompressionMiddleware implements NestMiddleware {
  private compressionMiddleware = compression({
    filter: (req: Request, res: Response) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
    threshold: 1024, // Only compress responses larger than 1KB
  });

  use(req: Request, res: Response, next: NextFunction) {
    this.compressionMiddleware(req, res, next);
  }
}

// CORS configuration
export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Production allowlist
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://localhost:8080',
      'https://*.huntersrun.com', // Production domains
      'https://*.huntersrun.app'  // Staging domains
    ];
    
    // Development mode - allow all localhost
    if (process.env.NODE_ENV === 'development') {
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
    }
    
    // Check against allowlist
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (allowedOrigin.includes('*')) {
        const pattern = allowedOrigin.replace('*.', '');
        return origin.endsWith(pattern);
      }
      return origin === allowedOrigin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('CORS: Origin not allowed'), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-org-id',
    'x-request-id',
    'idempotency-key'
  ],
  exposedHeaders: [
    'x-request-id',
    'x-idempotency-cached',
    'x-idempotency-age',
    'x-ratelimit-limit',
    'x-ratelimit-remaining',
    'x-ratelimit-reset'
  ],
  credentials: true,
  maxAge: 86400 // 24 hours
};

// Rate limiting configurations
export const createRateLimiter = (windowMs: number, max: number, message: string) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      code: 'RATE-LIMIT-EXCEEDED',
      message,
      meta: {
        requestId: 'rate-limit-blocked',
        timestamp: new Date().toISOString()
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      // Rate limit by organization + IP for better multi-tenant isolation
      const orgId = req.headers['x-org-id'] as string || 'anonymous';
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      return `${orgId}:${ip}`;
    },
    skip: (req: Request) => {
      // Skip rate limiting for health checks
      return req.path.startsWith('/api/health') || 
             req.path.startsWith('/api/ready') ||
             req.path === '/api/metrics';
    }
  });
};

// Different rate limits for different endpoint types
export const rateLimiters = {
  // General API endpoints - 1000 requests per hour per org+IP
  general: createRateLimiter(
    60 * 60 * 1000, // 1 hour
    1000,
    'Too many requests. General API limit: 1000 requests per hour per organization.'
  ),
  
  // Write operations - 100 requests per 15 minutes per org+IP  
  write: createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    100,
    'Too many write operations. Limit: 100 requests per 15 minutes per organization.'
  ),
  
  // Authentication/sensitive endpoints - 20 requests per hour per IP
  auth: createRateLimiter(
    60 * 60 * 1000, // 1 hour
    20,
    'Too many authentication attempts. Limit: 20 requests per hour.'
  ),
  
  // Webhook endpoints - 500 requests per hour per IP
  webhook: createRateLimiter(
    60 * 60 * 1000, // 1 hour
    500,
    'Too many webhook requests. Limit: 500 requests per hour.'
  )
};