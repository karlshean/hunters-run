import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from './database.service';

export type AuditEvent = {
  orgId: string;           // from x-org-id
  actorId?: string;        // optional for now
  action: string;          // e.g. "work_order.created"
  entity: 'work_order' | 'payment' | 'role' | 'evidence' | 'allocation';
  entityId: string;
  metadata?: Record<string, unknown>;
};

export interface AuditChainVerification {
  valid: boolean;
  totalEvents: number;
  firstBadEvent?: {
    id: string;
    entity: string;
    entityId: string;
    expectedHash: string;
    actualHash: string;
  };
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Log an audit event to the immutable audit log
   */
  async log(event: AuditEvent): Promise<string> {
    return this.db.executeWithOrgContext(event.orgId, async (client) => {
      try {
        const result = await client.query(`
          SELECT hr.create_audit_log_entry($1, $2, $3, $4, $5, $6) as id
        `, [
          event.orgId,
          event.action,
          event.entity,
          event.entityId,
          event.actorId || null,
          JSON.stringify(event.metadata || {})
        ]);

        const auditId = result.rows[0]?.id;
        
        this.logger.log(`Audit logged: ${event.action} for ${event.entity}:${event.entityId} (${auditId})`);
        
        return auditId;
      } catch (error) {
        this.logger.error(`Failed to log audit event: ${event.action}`, error);
        throw error;
      }
    });
  }

  /**
   * Verify the integrity of all audit chains for an organization
   */
  async verifyChains(orgId: string): Promise<AuditChainVerification> {
    return this.db.executeWithOrgContext(orgId, async (client) => {
      // Get all audit events for the organization ordered by chain and time
      const result = await client.query(`
        SELECT id, entity, entity_id, prev_hash, hash, created_at, 
               org_id, actor_id, action, metadata
        FROM hr.audit_log
        WHERE org_id = $1
        ORDER BY entity, entity_id, created_at, id
      `, [orgId]);

      const events = result.rows;
      let totalEvents = events.length;
      
      if (totalEvents === 0) {
        return { valid: true, totalEvents: 0 };
      }

      // Group events by chain key (entity + entity_id)
      const chains = new Map<string, any[]>();
      for (const event of events) {
        const chainKey = `${event.entity}|${event.entity_id}`;
        if (!chains.has(chainKey)) {
          chains.set(chainKey, []);
        }
        chains.get(chainKey)!.push(event);
      }

      // Verify each chain
      for (const [chainKey, chainEvents] of chains) {
        let expectedPrevHash: Buffer | null = null;
        
        for (const event of chainEvents) {
          // Check if prev_hash matches expected
          const actualPrevHash = event.prev_hash;
          
          if (expectedPrevHash === null) {
            // First event in chain should have null prev_hash
            if (actualPrevHash !== null) {
              return {
                valid: false,
                totalEvents,
                firstBadEvent: {
                  id: event.id,
                  entity: event.entity,
                  entityId: event.entity_id,
                  expectedHash: 'null',
                  actualHash: actualPrevHash ? actualPrevHash.toString('hex') : 'null'
                }
              };
            }
          } else {
            // Subsequent events should have prev_hash matching previous event's hash
            if (!actualPrevHash || !actualPrevHash.equals(expectedPrevHash)) {
              return {
                valid: false,
                totalEvents,
                firstBadEvent: {
                  id: event.id,
                  entity: event.entity,
                  entityId: event.entity_id,
                  expectedHash: expectedPrevHash.toString('hex'),
                  actualHash: actualPrevHash ? actualPrevHash.toString('hex') : 'null'
                }
              };
            }
          }

          // Recompute hash to verify integrity
          const payload = JSON.stringify({
            org_id: event.org_id,
            actor_id: event.actor_id,
            action: event.action,
            entity: event.entity,
            entity_id: event.entity_id,
            metadata: event.metadata || {},
            created_at: event.created_at
          });

          const crypto = require('crypto');
          const prevHashHex = expectedPrevHash ? expectedPrevHash.toString('hex') : '';
          const computedHash = crypto.createHash('sha256')
            .update(prevHashHex + ':' + payload)
            .digest();

          if (!computedHash.equals(event.hash)) {
            return {
              valid: false,
              totalEvents,
              firstBadEvent: {
                id: event.id,
                entity: event.entity,
                entityId: event.entity_id,
                expectedHash: computedHash.toString('hex'),
                actualHash: event.hash.toString('hex')
              }
            };
          }

          // Set up for next iteration
          expectedPrevHash = event.hash;
        }
      }

      return { valid: true, totalEvents };
    });
  }

  /**
   * Get audit events for a specific entity
   */
  async getEntityAuditTrail(orgId: string, entity: string, entityId: string): Promise<any[]> {
    return this.db.executeWithOrgContext(orgId, async (client) => {
      const result = await client.query(`
        SELECT id, action, actor_id, metadata, created_at, 
               encode(prev_hash, 'hex') as prev_hash_hex,
               encode(hash, 'hex') as hash_hex
        FROM hr.audit_log
        WHERE org_id = $1 AND entity = $2 AND entity_id = $3
        ORDER BY created_at ASC, id ASC
      `, [orgId, entity, entityId]);

      return result.rows;
    });
  }
}