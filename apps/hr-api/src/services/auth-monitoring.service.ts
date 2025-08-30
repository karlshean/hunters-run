import { Injectable } from '@nestjs/common';
import { MonitoringMiddleware } from '../middleware/monitoring.middleware';

@Injectable()
export class AuthMonitoringService {
  
  logAuthenticationAttempt(userId: string, provider: string, success: boolean, error?: string) {
    MonitoringMiddleware.logEvent({
      type: 'auth',
      event: 'authentication_attempt',
      userId,
      success,
      error,
      metadata: {
        provider,
        timestamp: new Date().toISOString()
      }
    });
  }

  logTokenValidation(token: string, success: boolean, organizationId?: string, error?: string) {
    MonitoringMiddleware.logEvent({
      type: 'auth',
      event: 'token_validation',
      organizationId,
      success,
      error,
      metadata: {
        tokenPrefix: token.substring(0, 20) + '...',
        tokenLength: token.length
      }
    });
  }

  logUserLookup(externalSub: string, provider: string, found: boolean, organizationId?: string) {
    MonitoringMiddleware.logEvent({
      type: 'auth',
      event: 'user_lookup',
      userId: externalSub,
      organizationId,
      success: found,
      metadata: {
        provider,
        lookupType: 'external_sub'
      }
    });
  }

  logOrganizationMembershipCheck(userId: string, organizationId: string, hasAccess: boolean) {
    MonitoringMiddleware.logEvent({
      type: 'auth',
      event: 'organization_membership_check',
      userId,
      organizationId,
      success: hasAccess,
      metadata: {
        checkType: 'membership_validation'
      }
    });
  }

  logFirebaseTokenDecoding(tokenId: string, success: boolean, uid?: string, error?: string) {
    MonitoringMiddleware.logEvent({
      type: 'firebase',
      event: 'token_decode',
      userId: uid,
      success,
      error,
      metadata: {
        tokenId: tokenId.substring(0, 10) + '...',
        decodedUid: uid
      }
    });
  }

  logFirebaseUserCreation(uid: string, email: string, success: boolean, error?: string) {
    MonitoringMiddleware.logEvent({
      type: 'firebase',
      event: 'user_creation',
      userId: uid,
      success,
      error,
      metadata: {
        email,
        provider: 'firebase'
      }
    });
  }

  logFirebaseServiceAccountInit(projectId: string, success: boolean, error?: string) {
    MonitoringMiddleware.logEvent({
      type: 'firebase',
      event: 'service_account_init',
      success,
      error,
      metadata: {
        projectId,
        sdkVersion: require('firebase-admin/package.json').version
      }
    });
  }

  logAuthContextSwitch(fromUserId?: string, toUserId?: string, organizationId?: string) {
    MonitoringMiddleware.logEvent({
      type: 'auth',
      event: 'context_switch',
      userId: toUserId,
      organizationId,
      success: true,
      metadata: {
        fromUserId,
        toUserId,
        switchType: 'organization_context'
      }
    });
  }

  logAuthorizationFailure(userId: string, resource: string, action: string, organizationId?: string) {
    MonitoringMiddleware.logEvent({
      type: 'auth',
      event: 'authorization_failure',
      userId,
      organizationId,
      success: false,
      metadata: {
        resource,
        action,
        failureType: 'insufficient_permissions'
      }
    });
  }

  // Utility methods for analytics
  getAuthMetrics(since?: Date) {
    const events = since 
      ? MonitoringMiddleware.getEventsSince(since)
      : MonitoringMiddleware.getEventsByType('auth');

    return {
      totalAttempts: events.filter(e => e.event === 'authentication_attempt').length,
      successfulAttempts: events.filter(e => e.event === 'authentication_attempt' && e.success).length,
      tokenValidations: events.filter(e => e.event === 'token_validation').length,
      authorizationFailures: events.filter(e => e.event === 'authorization_failure').length,
      contextSwitches: events.filter(e => e.event === 'context_switch').length
    };
  }

  getFirebaseMetrics(since?: Date) {
    const events = since 
      ? MonitoringMiddleware.getEventsSince(since)
      : MonitoringMiddleware.getEventsByType('firebase');

    return {
      tokenDecodes: events.filter(e => e.event === 'token_decode').length,
      successfulDecodes: events.filter(e => e.event === 'token_decode' && e.success).length,
      userCreations: events.filter(e => e.event === 'user_creation').length,
      serviceAccountInits: events.filter(e => e.event === 'service_account_init').length
    };
  }
}