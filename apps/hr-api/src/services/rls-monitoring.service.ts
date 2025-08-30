import { Injectable } from '@nestjs/common';
import { MonitoringMiddleware } from '../middleware/monitoring.middleware';

@Injectable()
export class RLSMonitoringService {

  logRLSContextSet(organizationId: string, success: boolean, sessionVariable = 'app.org_id', error?: string) {
    MonitoringMiddleware.logEvent({
      type: 'rls',
      event: 'context_set',
      organizationId,
      success,
      error,
      metadata: {
        sessionVariable,
        contextType: 'organization'
      }
    });
  }

  logRLSContextGet(sessionVariable = 'app.org_id', value?: string, success = true) {
    MonitoringMiddleware.logEvent({
      type: 'rls',
      event: 'context_get',
      organizationId: value,
      success,
      metadata: {
        sessionVariable,
        hasValue: !!value
      }
    });
  }

  logRLSQueryFiltered(
    table: string, 
    organizationId: string, 
    rowsReturned: number, 
    queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE',
    success = true
  ) {
    MonitoringMiddleware.logEvent({
      type: 'rls',
      event: 'query_filtered',
      organizationId,
      success,
      metadata: {
        table,
        queryType,
        rowsReturned,
        filteringActive: true
      }
    });
  }

  logRLSPolicyViolation(
    table: string,
    organizationId: string,
    attemptedAction: string,
    policyName?: string,
    error?: string
  ) {
    MonitoringMiddleware.logEvent({
      type: 'rls',
      event: 'policy_violation',
      organizationId,
      success: false,
      error,
      metadata: {
        table,
        attemptedAction,
        policyName,
        violationType: 'access_denied'
      }
    });
  }

  logCrossOrganizationAttempt(
    requestedOrgId: string,
    actualOrgId: string,
    table: string,
    action: string,
    blocked = true
  ) {
    MonitoringMiddleware.logEvent({
      type: 'rls',
      event: 'cross_organization_attempt',
      organizationId: actualOrgId,
      success: !blocked,
      metadata: {
        requestedOrgId,
        actualOrgId,
        table,
        action,
        blocked,
        securityBreach: !blocked
      }
    });
  }

  logRLSBypass(
    userId: string,
    organizationId: string,
    table: string,
    reason: 'superuser' | 'bypassrls' | 'admin_override'
  ) {
    MonitoringMiddleware.logEvent({
      type: 'rls',
      event: 'rls_bypass',
      userId,
      organizationId,
      success: true,
      metadata: {
        table,
        reason,
        requiresAudit: true,
        criticalEvent: true
      }
    });
  }

  logDataIsolationTest(
    organizationId: string,
    table: string,
    expectedRows: number,
    actualRows: number,
    testType: 'isolation_verification' | 'cross_org_access_test'
  ) {
    const success = expectedRows === actualRows;
    
    MonitoringMiddleware.logEvent({
      type: 'rls',
      event: 'data_isolation_test',
      organizationId,
      success,
      metadata: {
        table,
        testType,
        expectedRows,
        actualRows,
        isolationWorking: success
      }
    });
  }

  logSessionVariableCorruption(
    expectedOrgId: string,
    actualValue: string | null,
    sessionVariable = 'app.org_id'
  ) {
    MonitoringMiddleware.logEvent({
      type: 'rls',
      event: 'session_variable_corruption',
      organizationId: expectedOrgId,
      success: false,
      error: 'Session variable value corruption detected',
      metadata: {
        expectedValue: expectedOrgId,
        actualValue,
        sessionVariable,
        securityRisk: true
      }
    });
  }

  logRLSPerformanceImpact(
    table: string,
    organizationId: string,
    queryDuration: number,
    withoutRLS?: number
  ) {
    MonitoringMiddleware.logEvent({
      type: 'rls',
      event: 'performance_impact',
      organizationId,
      success: true,
      duration: queryDuration,
      metadata: {
        table,
        withRLSDuration: queryDuration,
        withoutRLSDuration: withoutRLS,
        performanceOverhead: withoutRLS ? (queryDuration - withoutRLS) : null
      }
    });
  }

  // Analytics methods
  getRLSMetrics(since?: Date) {
    const events = since 
      ? MonitoringMiddleware.getEventsSince(since)
      : MonitoringMiddleware.getEventsByType('rls');

    return {
      contextSets: events.filter(e => e.event === 'context_set').length,
      successfulContextSets: events.filter(e => e.event === 'context_set' && e.success).length,
      queriesFiltered: events.filter(e => e.event === 'query_filtered').length,
      policyViolations: events.filter(e => e.event === 'policy_violation').length,
      crossOrgAttempts: events.filter(e => e.event === 'cross_organization_attempt').length,
      blockedCrossOrgAttempts: events.filter(e => e.event === 'cross_organization_attempt' && !e.success).length,
      rlsBypasses: events.filter(e => e.event === 'rls_bypass').length,
      sessionCorruptions: events.filter(e => e.event === 'session_variable_corruption').length,
      avgQueryDuration: this.calculateAverageQueryDuration(events)
    };
  }

  getSecurityMetrics(since?: Date) {
    const events = since 
      ? MonitoringMiddleware.getEventsSince(since)
      : MonitoringMiddleware.getEventsByType('rls');

    const securityEvents = events.filter(e => 
      e.event === 'cross_organization_attempt' || 
      e.event === 'policy_violation' ||
      e.event === 'session_variable_corruption' ||
      e.event === 'rls_bypass'
    );

    return {
      totalSecurityEvents: securityEvents.length,
      securityBreaches: events.filter(e => e.metadata?.securityBreach === true).length,
      criticalEvents: events.filter(e => e.metadata?.criticalEvent === true).length,
      auditRequiredEvents: events.filter(e => e.metadata?.requiresAudit === true).length,
      securityEventsTimeline: securityEvents.map(e => ({
        timestamp: e.timestamp,
        event: e.event,
        organizationId: e.organizationId,
        severity: e.metadata?.criticalEvent ? 'HIGH' : 'MEDIUM'
      }))
    };
  }

  private calculateAverageQueryDuration(events: any[]): number {
    const performanceEvents = events.filter(e => e.event === 'performance_impact' && e.duration);
    if (performanceEvents.length === 0) return 0;
    
    const totalDuration = performanceEvents.reduce((sum, e) => sum + e.duration, 0);
    return totalDuration / performanceEvents.length;
  }
}