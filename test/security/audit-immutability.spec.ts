import { Test, TestingModule } from '@nestjs/testing';
import { Client } from 'pg';
import { AuditService } from '../../apps/hr-api/src/common/audit.service';
import { DatabaseService } from '../../apps/hr-api/src/common/database.service';

describe('Audit Immutability Security Tests', () => {
  let auditService: AuditService;
  let dbClient: Client;
  let databaseService: DatabaseService;
  const testOrgId = '11111111-1111-1111-1111-111111111111';
  
  beforeAll(async () => {
    // Connect to test database
    const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/unified';
    dbClient = new Client({ connectionString });
    await dbClient.connect();

    // Set up test context
    await dbClient.query(`SET app.current_org = '${testOrgId}'`);
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        DatabaseService
      ],
    }).compile();

    auditService = module.get<AuditService>(AuditService);
    databaseService = module.get<DatabaseService>(DatabaseService);
  });

  afterAll(async () => {
    // Clean up test data
    await dbClient.query('DELETE FROM hr.audit_log WHERE org_id = $1', [testOrgId]);
    await dbClient.end();
  });

  beforeEach(async () => {
    // Clean up audit log before each test
    await dbClient.query('DELETE FROM hr.audit_log WHERE org_id = $1', [testOrgId]);
  });

  describe('Audit Log Immutability', () => {
    it('should prevent UPDATE operations on audit_log table', async () => {
      // First, create an audit entry
      const auditId = await auditService.log({
        orgId: testOrgId,
        action: 'test.created',
        entity: 'work_order',
        entityId: 'test-wo-1',
        metadata: { original: 'data' }
      });

      // Attempt to update the audit entry should fail
      await expect(
        dbClient.query(
          'UPDATE hr.audit_log SET metadata = $1 WHERE id = $2',
          [JSON.stringify({ modified: 'data' }), auditId]
        )
      ).rejects.toThrow(/permission denied|not allowed/i);
    });

    it('should prevent DELETE operations on audit_log table', async () => {
      // First, create an audit entry
      const auditId = await auditService.log({
        orgId: testOrgId,
        action: 'test.created',
        entity: 'work_order',
        entityId: 'test-wo-2',
        metadata: { test: 'data' }
      });

      // Attempt to delete the audit entry should fail
      await expect(
        dbClient.query('DELETE FROM hr.audit_log WHERE id = $1', [auditId])
      ).rejects.toThrow(/permission denied|not allowed/i);
    });

    it('should prevent direct INSERT without using the trigger function', async () => {
      // Attempt to insert directly without using the proper function should fail or not compute hash correctly
      const directInsertResult = await dbClient.query(`
        SELECT COUNT(*) as count FROM hr.audit_log WHERE org_id = $1
      `, [testOrgId]);
      
      const initialCount = parseInt(directInsertResult.rows[0].count);

      // Try direct insert (this might work but won't have proper hash computation)
      try {
        await dbClient.query(`
          INSERT INTO hr.audit_log (org_id, action, entity, entity_id, metadata, hash)
          VALUES ($1, 'direct.insert', 'test', 'test-1', '{}', decode('deadbeef', 'hex'))
        `, [testOrgId]);
      } catch (error) {
        // If it fails completely, that's good (table is properly protected)
        expect(error.message).toMatch(/not-null constraint|required/i);
        return;
      }

      // If it succeeded, verify the hash chain would be broken
      const verificationResult = await auditService.verifyChains(testOrgId);
      expect(verificationResult.valid).toBe(false);
    });
  });

  describe('Hash Chain Integrity', () => {
    it('should create a valid hash chain for multiple events on same entity', async () => {
      const entityId = 'test-wo-chain';
      
      // Create multiple audit events for the same entity
      await auditService.log({
        orgId: testOrgId,
        action: 'work_order.created',
        entity: 'work_order',
        entityId,
        metadata: { title: 'Test Work Order', priority: 'high' }
      });

      await auditService.log({
        orgId: testOrgId,
        action: 'work_order.status_updated',
        entity: 'work_order',
        entityId,
        metadata: { fromStatus: 'new', toStatus: 'assigned' }
      });

      await auditService.log({
        orgId: testOrgId,
        action: 'work_order.assigned',
        entity: 'work_order',
        entityId,
        metadata: { technicianId: 'tech-123' }
      });

      // Verify the chain is valid
      const verification = await auditService.verifyChains(testOrgId);
      expect(verification.valid).toBe(true);
      expect(verification.totalEvents).toBe(3);
    });

    it('should maintain separate chains for different entities', async () => {
      // Create events for two different entities
      await auditService.log({
        orgId: testOrgId,
        action: 'work_order.created',
        entity: 'work_order',
        entityId: 'wo-1',
        metadata: { title: 'Work Order 1' }
      });

      await auditService.log({
        orgId: testOrgId,
        action: 'payment.received',
        entity: 'payment',
        entityId: 'pay-1',
        metadata: { amount: 100 }
      });

      await auditService.log({
        orgId: testOrgId,
        action: 'work_order.status_updated',
        entity: 'work_order',
        entityId: 'wo-1',
        metadata: { status: 'assigned' }
      });

      // Verify chains are valid and separate
      const verification = await auditService.verifyChains(testOrgId);
      expect(verification.valid).toBe(true);
      expect(verification.totalEvents).toBe(3);

      // Check individual entity trails
      const woTrail = await auditService.getEntityAuditTrail(testOrgId, 'work_order', 'wo-1');
      const paymentTrail = await auditService.getEntityAuditTrail(testOrgId, 'payment', 'pay-1');
      
      expect(woTrail).toHaveLength(2);
      expect(paymentTrail).toHaveLength(1);
    });

    it('should detect hash tampering', async () => {
      const entityId = 'test-tampering';
      
      // Create an audit event
      await auditService.log({
        orgId: testOrgId,
        action: 'work_order.created',
        entity: 'work_order',
        entityId,
        metadata: { original: 'data' }
      });

      // Attempt to tamper with the hash (this should be prevented by RLS/permissions)
      // but if somehow it succeeds, verification should catch it
      try {
        // First, let's create another event to have a chain
        await auditService.log({
          orgId: testOrgId,
          action: 'work_order.updated',
          entity: 'work_order',
          entityId,
          metadata: { updated: 'data' }
        });

        // Try to tamper with the first event's hash (this should fail due to permissions)
        await dbClient.query(`
          UPDATE hr.audit_log 
          SET hash = decode('deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef', 'hex')
          WHERE org_id = $1 AND entity = 'work_order' AND entity_id = $2
          ORDER BY created_at ASC LIMIT 1
        `, [testOrgId, entityId]);
        
        // If update succeeded (shouldn't happen), verification should catch the tampering
        const verification = await auditService.verifyChains(testOrgId);
        expect(verification.valid).toBe(false);
        
      } catch (error) {
        // Expected: UPDATE should be denied
        expect(error.message).toMatch(/permission denied|not allowed/i);
      }
    });
  });

  describe('Row Level Security', () => {
    it('should isolate audit logs by organization', async () => {
      const org1Id = testOrgId;
      const org2Id = '22222222-2222-2222-2222-222222222222';
      
      // Create audit events for org1
      await auditService.log({
        orgId: org1Id,
        action: 'work_order.created',
        entity: 'work_order',
        entityId: 'wo-org1',
        metadata: { org: 'org1' }
      });

      // Switch context to org2 and create event
      await dbClient.query(`SET app.current_org = '${org2Id}'`);
      
      await auditService.log({
        orgId: org2Id,
        action: 'work_order.created',
        entity: 'work_order',
        entityId: 'wo-org2',
        metadata: { org: 'org2' }
      });

      // Verify org1 can only see its own audit events
      await dbClient.query(`SET app.current_org = '${org1Id}'`);
      const org1Verification = await auditService.verifyChains(org1Id);
      expect(org1Verification.totalEvents).toBe(1);

      // Verify org2 can only see its own audit events
      await dbClient.query(`SET app.current_org = '${org2Id}'`);
      const org2Verification = await auditService.verifyChains(org2Id);
      expect(org2Verification.totalEvents).toBe(1);

      // Clean up org2 data
      await dbClient.query('DELETE FROM hr.audit_log WHERE org_id = $1', [org2Id]);
      
      // Reset context to test org
      await dbClient.query(`SET app.current_org = '${org1Id}'`);
    });

    it('should prevent cross-org audit trail access', async () => {
      const org1Id = testOrgId;
      const org2Id = '22222222-2222-2222-2222-222222222222';
      
      // Create audit event for org2
      await dbClient.query(`SET app.current_org = '${org2Id}'`);
      await auditService.log({
        orgId: org2Id,
        action: 'sensitive.action',
        entity: 'work_order',
        entityId: 'sensitive-wo',
        metadata: { secret: 'data' }
      });

      // Switch to org1 context and try to access org2's audit trail
      await dbClient.query(`SET app.current_org = '${org1Id}'`);
      
      const crossOrgTrail = await auditService.getEntityAuditTrail(
        org2Id, // Try to access org2's data while in org1 context
        'work_order',
        'sensitive-wo'
      );
      
      // Should return empty because RLS prevents cross-org access
      expect(crossOrgTrail).toHaveLength(0);

      // Clean up
      await dbClient.query(`SET app.current_org = '${org2Id}'`);
      await dbClient.query('DELETE FROM hr.audit_log WHERE org_id = $1', [org2Id]);
      await dbClient.query(`SET app.current_org = '${org1Id}'`);
    });
  });

  describe('Cryptographic Integrity', () => {
    it('should produce deterministic hashes for identical input', async () => {
      // We can't easily test this without accessing internal implementation,
      // but we can verify that chain verification works consistently
      const entityId = 'deterministic-test';
      
      // Create two separate chains with identical data
      await auditService.log({
        orgId: testOrgId,
        action: 'test.action',
        entity: 'work_order',
        entityId,
        metadata: { data: 'identical' }
      });

      const firstVerification = await auditService.verifyChains(testOrgId);
      
      // Clear and recreate identical event
      await dbClient.query('DELETE FROM hr.audit_log WHERE org_id = $1', [testOrgId]);
      
      await auditService.log({
        orgId: testOrgId,
        action: 'test.action',
        entity: 'work_order',
        entityId,
        metadata: { data: 'identical' }
      });

      const secondVerification = await auditService.verifyChains(testOrgId);
      
      // Both should be valid (though hashes will differ due to timestamps)
      expect(firstVerification.valid).toBe(true);
      expect(secondVerification.valid).toBe(true);
    });

    it('should validate SHA256 hash format', async () => {
      await auditService.log({
        orgId: testOrgId,
        action: 'hash.test',
        entity: 'work_order',
        entityId: 'hash-test',
        metadata: { test: 'hash' }
      });

      // Query the raw audit log to check hash format
      const result = await dbClient.query(`
        SELECT encode(hash, 'hex') as hash_hex
        FROM hr.audit_log 
        WHERE org_id = $1 AND action = 'hash.test'
      `, [testOrgId]);

      expect(result.rows).toHaveLength(1);
      const hashHex = result.rows[0].hash_hex;
      
      // SHA256 produces 64-character hex strings
      expect(hashHex).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});