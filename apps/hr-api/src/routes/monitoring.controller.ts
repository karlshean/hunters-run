import { Controller, Get, Query, Headers, BadRequestException } from '@nestjs/common';
import { MonitoringMiddleware } from '../middleware/monitoring.middleware';
import { AuthMonitoringService } from '../services/auth-monitoring.service';
import { RLSMonitoringService } from '../services/rls-monitoring.service';

@Controller()
export class MonitoringController {
  constructor(
    private readonly authMonitoring: AuthMonitoringService,
    private readonly rlsMonitoring: RLSMonitoringService
  ) {}

  @Get('api/monitoring/health')
  getHealthMetrics() {
    const now = Date.now();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    
    const recentEvents = MonitoringMiddleware.getEventsSince(oneHourAgo);
    const errors = recentEvents.filter(e => !e.success);
    
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      metrics: {
        totalEvents: recentEvents.length,
        errorRate: recentEvents.length > 0 ? (errors.length / recentEvents.length) * 100 : 0,
        eventsByType: {
          auth: recentEvents.filter(e => e.type === 'auth').length,
          rls: recentEvents.filter(e => e.type === 'rls').length,
          firebase: recentEvents.filter(e => e.type === 'firebase').length,
          api: recentEvents.filter(e => e.type === 'api').length,
          error: recentEvents.filter(e => e.type === 'error').length
        },
        recentErrors: errors.slice(-5).map(e => ({
          timestamp: e.timestamp,
          type: e.type,
          event: e.event,
          error: e.error
        }))
      }
    };
  }

  @Get('api/monitoring/auth')
  getAuthMetrics(
    @Query('since') since?: string,
    @Headers('x-org-id') orgId?: string
  ) {
    if (!orgId) {
      throw new BadRequestException('Missing required header: x-org-id');
    }

    const sinceDate = since ? new Date(since) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    return {
      organizationId: orgId,
      timeRange: {
        since: sinceDate.toISOString(),
        until: new Date().toISOString()
      },
      auth: this.authMonitoring.getAuthMetrics(sinceDate),
      firebase: this.authMonitoring.getFirebaseMetrics(sinceDate)
    };
  }

  @Get('api/monitoring/rls')
  getRLSMetrics(
    @Query('since') since?: string,
    @Headers('x-org-id') orgId?: string
  ) {
    if (!orgId) {
      throw new BadRequestException('Missing required header: x-org-id');
    }

    const sinceDate = since ? new Date(since) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    return {
      organizationId: orgId,
      timeRange: {
        since: sinceDate.toISOString(),
        until: new Date().toISOString()
      },
      rls: this.rlsMonitoring.getRLSMetrics(sinceDate),
      security: this.rlsMonitoring.getSecurityMetrics(sinceDate)
    };
  }

  @Get('api/monitoring/security')
  getSecurityDashboard(
    @Query('since') since?: string,
    @Headers('x-org-id') orgId?: string
  ) {
    if (!orgId) {
      throw new BadRequestException('Missing required header: x-org-id');
    }

    const sinceDate = since ? new Date(since) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const events = MonitoringMiddleware.getEventsSince(sinceDate);
    
    // Filter events for this organization or security-relevant events
    const orgEvents = events.filter(e => 
      e.organizationId === orgId || 
      e.metadata?.securityBreach === true ||
      e.metadata?.criticalEvent === true
    );

    return {
      organizationId: orgId,
      timeRange: {
        since: sinceDate.toISOString(),
        until: new Date().toISOString()
      },
      summary: {
        totalEvents: orgEvents.length,
        authEvents: orgEvents.filter(e => e.type === 'auth').length,
        rlsEvents: orgEvents.filter(e => e.type === 'rls').length,
        securityIncidents: orgEvents.filter(e => !e.success && (e.type === 'auth' || e.type === 'rls')).length,
        criticalEvents: orgEvents.filter(e => e.metadata?.criticalEvent === true).length
      },
      recentIncidents: orgEvents
        .filter(e => !e.success)
        .slice(-10)
        .map(e => ({
          timestamp: e.timestamp,
          type: e.type,
          event: e.event,
          severity: e.metadata?.criticalEvent ? 'HIGH' : 'MEDIUM',
          details: e.error || 'No error details',
          metadata: e.metadata
        })),
      organizationActivity: {
        apiCalls: orgEvents.filter(e => e.type === 'api').length,
        authAttempts: orgEvents.filter(e => e.type === 'auth' && e.event === 'authentication_attempt').length,
        successfulAuth: orgEvents.filter(e => e.type === 'auth' && e.event === 'authentication_attempt' && e.success).length,
        rlsContextSets: orgEvents.filter(e => e.type === 'rls' && e.event === 'context_set').length,
        crossOrgAttempts: orgEvents.filter(e => e.event === 'cross_organization_attempt').length
      }
    };
  }

  @Get('api/monitoring/performance')
  getPerformanceMetrics(
    @Query('since') since?: string,
    @Headers('x-org-id') orgId?: string
  ) {
    if (!orgId) {
      throw new BadRequestException('Missing required header: x-org-id');
    }

    const sinceDate = since ? new Date(since) : new Date(Date.now() - 60 * 60 * 1000); // Last hour
    const events = MonitoringMiddleware.getEventsSince(sinceDate);
    
    const apiEvents = events.filter(e => e.type === 'api' && e.organizationId === orgId);
    const avgResponseTime = apiEvents.length > 0 
      ? apiEvents.reduce((sum, e) => sum + (e.duration || 0), 0) / apiEvents.length 
      : 0;

    const endpointStats = apiEvents.reduce((stats, event) => {
      const key = `${event.method} ${event.endpoint}`;
      if (!stats[key]) {
        stats[key] = { count: 0, totalDuration: 0, errors: 0 };
      }
      stats[key].count++;
      stats[key].totalDuration += event.duration || 0;
      if (!event.success) stats[key].errors++;
      return stats;
    }, {} as Record<string, { count: number; totalDuration: number; errors: number }>);

    const topEndpoints = Object.entries(endpointStats)
      .map(([endpoint, stats]) => ({
        endpoint,
        count: stats.count,
        avgDuration: stats.count > 0 ? stats.totalDuration / stats.count : 0,
        errorRate: stats.count > 0 ? (stats.errors / stats.count) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      organizationId: orgId,
      timeRange: {
        since: sinceDate.toISOString(),
        until: new Date().toISOString()
      },
      performance: {
        totalRequests: apiEvents.length,
        avgResponseTime: Math.round(avgResponseTime),
        errorRate: apiEvents.length > 0 ? (apiEvents.filter(e => !e.success).length / apiEvents.length) * 100 : 0,
        slowestRequests: apiEvents
          .filter(e => e.duration && e.duration > 1000) // Requests slower than 1 second
          .sort((a, b) => (b.duration || 0) - (a.duration || 0))
          .slice(0, 5)
          .map(e => ({
            timestamp: e.timestamp,
            endpoint: e.endpoint,
            method: e.method,
            duration: e.duration
          })),
        topEndpoints
      }
    };
  }

  @Get('api/monitoring/events')
  getRecentEvents(
    @Query('type') type?: string,
    @Query('limit') limitStr?: string,
    @Query('since') since?: string,
    @Headers('x-org-id') orgId?: string
  ) {
    if (!orgId) {
      throw new BadRequestException('Missing required header: x-org-id');
    }

    const limit = parseInt(limitStr || '50', 10);
    const sinceDate = since ? new Date(since) : new Date(Date.now() - 60 * 60 * 1000);
    
    let events = MonitoringMiddleware.getEventsSince(sinceDate);
    
    // Filter by organization
    events = events.filter(e => e.organizationId === orgId);
    
    // Filter by type if specified
    if (type && ['auth', 'rls', 'firebase', 'api', 'error'].includes(type)) {
      events = events.filter(e => e.type === type);
    }

    // Sort by timestamp (newest first) and limit
    events = events
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    return {
      organizationId: orgId,
      typeFilter: type || 'all',
      limit,
      count: events.length,
      events: events.map(e => ({
        timestamp: e.timestamp,
        type: e.type,
        event: e.event,
        success: e.success,
        duration: e.duration,
        error: e.error,
        metadata: e.metadata
      }))
    };
  }
}