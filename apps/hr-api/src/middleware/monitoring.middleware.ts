import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface RequestWithTiming extends Request {
  startTime?: number;
  requestId?: string;
}

type EventRecord = {
  ts: number;
  type: string;
  payload?: any;
};

declare global {
  // eslint-disable-next-line no-var
  var httpEvents: EventRecord[] | undefined;
}

// Ensure storage exists (runtime)
function ensureEventStore(): EventRecord[] {
  if (!global.httpEvents) global.httpEvents = [];
  return global.httpEvents!;
}

@Injectable()
export class MonitoringMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: RequestWithTiming, res: Response, next: NextFunction) {
    const startTime = Date.now();
    req.startTime = startTime;

    const { method, originalUrl, ip } = req;
    const userAgent = req.get('User-Agent') || '';
    const orgId = (req.headers['x-org-id'] as string) || 'anonymous';
    const requestId = req.requestId || 'unknown';

    // Log request start (only in development)
    if (process.env.NODE_ENV === 'development') {
      this.logger.log(
        `${method} ${originalUrl} - ${ip} - Org: ${orgId.substring(
          0,
          8,
        )}... - UA: ${userAgent.substring(0, 50)}`,
      );
    }

    // Enhanced response monitoring
    res.on('finish', () => {
      const { statusCode } = res;
      const responseTime = Date.now() - startTime;
      const contentLength = res.get('content-length');

      // Always log errors and slow requests
      if (statusCode >= 400) {
        this.logger.error(
          `${method} ${originalUrl} ${statusCode} - ${responseTime}ms - ${ip} - Org: ${orgId.substring(
            0,
            8,
          )}... - Req: ${requestId}`,
        );
      } else if (responseTime > 1000) {
        this.logger.warn(
          `SLOW REQUEST: ${method} ${originalUrl} ${statusCode} - ${responseTime}ms - ${ip} - Org: ${orgId.substring(
            0,
            8,
          )}...`,
        );
      }

      // Log all requests in production for metrics
      if (process.env.NODE_ENV === 'production') {
        this.logger.log(
          `${method} ${originalUrl} ${statusCode} - ${responseTime}ms - ${
            contentLength || 0
          }b - Org: ${orgId.substring(0, 8)}...`,
        );
      }

      // Set performance headers
      res.setHeader('x-response-time', `${responseTime}ms`);
      if (responseTime > 500) {
        res.setHeader('x-performance-warning', 'slow-response');
      }

      // Collect metrics for monitoring systems
      this.collectMetrics(method, originalUrl, statusCode, responseTime, orgId);

      // Log event for event history
      MonitoringMiddleware.logEvent('http', {
        method,
        path: originalUrl,
        statusCode,
        responseTime,
        orgId,
      });
    });

    res.on('error', (err) => {
      this.logger.error(
        `Response error: ${method} ${originalUrl} - ${err.message} - Req: ${requestId}`,
      );
    });

    next();
  }

  private collectMetrics(
    method: string,
    path: string,
    statusCode: number,
    responseTime: number,
    orgId: string,
  ) {
    if (!global.httpMetrics) {
      global.httpMetrics = {
        requests: 0,
        errors: 0,
        totalResponseTime: 0,
        slowRequests: 0,
        orgMetrics: new Map(),
      };
    }

    const metrics = global.httpMetrics;
    metrics.requests++;
    metrics.totalResponseTime += responseTime;

    if (statusCode >= 400) {
      metrics.errors++;
    }

    if (responseTime > 1000) {
      metrics.slowRequests++;
    }

    if (!metrics.orgMetrics.has(orgId)) {
      metrics.orgMetrics.set(orgId, {
        requests: 0,
        errors: 0,
        avgResponseTime: 0,
      });
    }

    const orgMetrics = metrics.orgMetrics.get(orgId);
    orgMetrics.requests++;
    if (statusCode >= 400) {
      orgMetrics.errors++;
    }
    orgMetrics.avgResponseTime =
      (orgMetrics.avgResponseTime * (orgMetrics.requests - 1) + responseTime) /
      orgMetrics.requests;
  }

  // Static method to get current metrics
  static getMetrics() {
    if (!global.httpMetrics) {
      return {
        requests: 0,
        errors: 0,
        avgResponseTime: 0,
        errorRate: 0,
        slowRequests: 0,
        organizations: 0,
      };
    }

    const metrics = global.httpMetrics;
    return {
      requests: metrics.requests,
      errors: metrics.errors,
      avgResponseTime:
        metrics.requests > 0
          ? Math.round(metrics.totalResponseTime / metrics.requests)
          : 0,
      errorRate:
        metrics.requests > 0
          ? Math.round((metrics.errors / metrics.requests) * 100)
          : 0,
      slowRequests: metrics.slowRequests,
      organizations: metrics.orgMetrics.size,
    };
  }

  static resetMetrics() {
    global.httpMetrics = {
      requests: 0,
      errors: 0,
      totalResponseTime: 0,
      slowRequests: 0,
      orgMetrics: new Map(),
    };
  }

  // --- Added for controllers/services that query recent events ---
  static logEvent(type: string, payload?: any) {
    const events = ensureEventStore();
    events.push({ ts: Date.now(), type, payload });
  }

  static getEventsSince(msAgo: number): EventRecord[] {
    const events = ensureEventStore();
    const cutoff = Date.now() - Math.max(0, msAgo || 0);
    return events.filter((e) => e.ts >= cutoff);
  }

  static getEventsByType(type: string, msAgo?: number): EventRecord[] {
    const events = this.getEventsSince(msAgo ?? 0);
    return events.filter((e) => e.type === type);
  }
}