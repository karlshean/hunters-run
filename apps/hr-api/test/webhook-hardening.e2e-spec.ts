import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Client } from 'pg';
import { AppModule } from '../src/app.module';

describe('Webhook Hardening (e2e)', () => {
  let app: INestApplication;
  let dbClient: Client;

  const TEST_ORG_ID = '00000000-0000-4000-8000-000000000001';
  const TEST_TENANT_ID = '00000000-0000-4000-8000-000000000004';

  const createStripeEvent = (eventId: string, sessionId: string, eventType = 'checkout.session.completed') => ({
    id: eventId,
    type: eventType,
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: sessionId,
        payment_status: 'paid',
        amount_total: 120000,
        metadata: {
          organization_id: TEST_ORG_ID,
          tenantId: TEST_TENANT_ID
        }
      }
    }
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dbClient = new Client({
      host: 'localhost',
      port: 5432,
      database: 'unified',
      user: 'postgres'
    });
    await dbClient.connect();

    // Apply migrations first
    await dbClient.query('BEGIN');
    try {
      // Ensure webhook tables exist
      await dbClient.query(`
        CREATE TABLE IF NOT EXISTS payments.webhook_events (
          provider TEXT NOT NULL,
          event_id TEXT NOT NULL,
          received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          payload JSONB NOT NULL,
          PRIMARY KEY (provider, event_id)
        )
      `);

      await dbClient.query(`
        CREATE TABLE IF NOT EXISTS payments.webhook_failures (
          id BIGSERIAL PRIMARY KEY,
          provider TEXT NOT NULL,
          event_id TEXT NOT NULL,
          payload JSONB NOT NULL,
          error_message TEXT NOT NULL,
          error_stack TEXT,
          retry_count INTEGER NOT NULL DEFAULT 0,
          last_retry_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (provider, event_id)
        )
      `);

      await dbClient.query('COMMIT');
    } catch (error) {
      await dbClient.query('ROLLBACK');
      throw error;
    }
  });

  afterAll(async () => {
    await dbClient.end();
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await dbClient.query('DELETE FROM payments.webhook_events WHERE provider = $1', ['stripe']);
    await dbClient.query('DELETE FROM payments.webhook_failures WHERE provider = $1', ['stripe']);
  });

  describe('Webhook Replay Protection', () => {
    it('should process webhook only once when replayed 5 times', async () => {
      const eventId = 'evt_test_replay_' + Date.now();
      const sessionId = 'cs_test_session_' + Date.now();
      const webhookEvent = createStripeEvent(eventId, sessionId);

      // Send the same webhook 5 times
      const responses = [];
      for (let i = 0; i < 5; i++) {
        const response = await request(app.getHttpServer())
          .post('/api/payments/webhook')
          .set('stripe-signature', 'test')
          .set('Content-Type', 'application/json')
          .send(webhookEvent);
        
        responses.push(response);
      }

      // First request should succeed
      expect(responses[0].status).toBe(201);
      expect(responses[0].body.received).toBe(true);
      expect(responses[0].body.duplicate).toBeUndefined();

      // Subsequent requests should be marked as duplicates
      for (let i = 1; i < 5; i++) {
        expect(responses[i].status).toBe(201);
        expect(responses[i].body.received).toBe(true);
        expect(responses[i].body.duplicate).toBe(true);
      }

      // Verify only one event was recorded
      const eventsResult = await dbClient.query(
        'SELECT COUNT(*) as count FROM payments.webhook_events WHERE event_id = $1',
        [eventId]
      );
      expect(parseInt(eventsResult.rows[0].count)).toBe(1);

      // Verify the event was recorded with correct data
      const eventResult = await dbClient.query(
        'SELECT * FROM payments.webhook_events WHERE event_id = $1',
        [eventId]
      );
      expect(eventResult.rows).toHaveLength(1);
      expect(eventResult.rows[0].provider).toBe('stripe');
      expect(JSON.parse(eventResult.rows[0].payload).id).toBe(eventId);
    });

    it('should handle different events with same timestamp', async () => {
      const timestamp = Date.now();
      const event1 = createStripeEvent(`evt_1_${timestamp}`, `cs_1_${timestamp}`);
      const event2 = createStripeEvent(`evt_2_${timestamp}`, `cs_2_${timestamp}`);

      // Send both events
      const response1 = await request(app.getHttpServer())
        .post('/api/payments/webhook')
        .set('stripe-signature', 'test')
        .set('Content-Type', 'application/json')
        .send(event1);

      const response2 = await request(app.getHttpServer())
        .post('/api/payments/webhook')
        .set('stripe-signature', 'test')
        .set('Content-Type', 'application/json')
        .send(event2);

      expect(response1.status).toBe(201);
      expect(response2.status).toBe(201);
      expect(response1.body.duplicate).toBeUndefined();
      expect(response2.body.duplicate).toBeUndefined();

      // Verify both events were recorded
      const eventsResult = await dbClient.query(
        'SELECT COUNT(*) as count FROM payments.webhook_events WHERE event_id LIKE $1',
        [`%_${timestamp}`]
      );
      expect(parseInt(eventsResult.rows[0].count)).toBe(2);
    });
  });

  describe('Out-of-Order Events', () => {
    it('should process events gracefully regardless of order', async () => {
      const timestamp = Date.now();
      const events = [
        createStripeEvent(`evt_3_${timestamp}`, `cs_3_${timestamp}`),
        createStripeEvent(`evt_1_${timestamp}`, `cs_1_${timestamp}`),
        createStripeEvent(`evt_2_${timestamp}`, `cs_2_${timestamp}`)
      ];

      // Send events in out-of-order sequence
      const responses = [];
      for (const event of events) {
        const response = await request(app.getHttpServer())
          .post('/api/payments/webhook')
          .set('stripe-signature', 'test')
          .set('Content-Type', 'application/json')
          .send(event);
        
        responses.push(response);
      }

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.received).toBe(true);
      });

      // Verify all events were recorded
      const eventsResult = await dbClient.query(
        'SELECT event_id FROM payments.webhook_events WHERE event_id LIKE $1 ORDER BY event_id',
        [`%_${timestamp}`]
      );
      expect(eventsResult.rows).toHaveLength(3);
      expect(eventsResult.rows.map(r => r.event_id)).toEqual([
        `evt_1_${timestamp}`,
        `evt_2_${timestamp}`,
        `evt_3_${timestamp}`
      ]);
    });
  });

  describe('Signature Validation', () => {
    it('should skip validation when ALLOW_INSECURE_STRIPE_WEBHOOK_TEST is true', async () => {
      process.env.ALLOW_INSECURE_STRIPE_WEBHOOK_TEST = 'true';

      const eventId = 'evt_test_insecure_' + Date.now();
      const sessionId = 'cs_test_insecure_' + Date.now();
      const webhookEvent = createStripeEvent(eventId, sessionId);

      // Send webhook without proper signature
      const response = await request(app.getHttpServer())
        .post('/api/payments/webhook')
        .set('Content-Type', 'application/json')
        .send(webhookEvent);

      expect(response.status).toBe(201);
      expect(response.body.received).toBe(true);

      // Clean up
      delete process.env.ALLOW_INSECURE_STRIPE_WEBHOOK_TEST;
    });

    it('should require signature when ALLOW_INSECURE_STRIPE_WEBHOOK_TEST is false', async () => {
      process.env.ALLOW_INSECURE_STRIPE_WEBHOOK_TEST = 'false';

      const eventId = 'evt_test_secure_' + Date.now();
      const sessionId = 'cs_test_secure_' + Date.now();
      const webhookEvent = createStripeEvent(eventId, sessionId);

      // Send webhook without stripe-signature header
      const response = await request(app.getHttpServer())
        .post('/api/payments/webhook')
        .set('Content-Type', 'application/json')
        .send(webhookEvent);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Missing Stripe signature');

      // Clean up
      delete process.env.ALLOW_INSECURE_STRIPE_WEBHOOK_TEST;
    });
  });

  describe('Dead Letter Pattern', () => {
    it('should record webhook failures and allow retry', async () => {
      const eventId = 'evt_test_failure_' + Date.now();
      const sessionId = 'cs_test_failure_' + Date.now();
      
      // Create event with invalid organization_id to cause failure
      const webhookEvent = createStripeEvent(eventId, sessionId);
      webhookEvent.data.object.metadata.organization_id = 'invalid-org-id';

      // Send webhook that will fail
      const response = await request(app.getHttpServer())
        .post('/api/payments/webhook')
        .set('stripe-signature', 'test')
        .set('Content-Type', 'application/json')
        .send(webhookEvent);

      expect(response.status).toBe(400);

      // Check if failure was recorded
      const failureResult = await dbClient.query(
        'SELECT id, event_id, error_message, retry_count FROM payments.webhook_failures WHERE event_id = $1',
        [eventId]
      );
      expect(failureResult.rows).toHaveLength(1);
      expect(failureResult.rows[0].event_id).toBe(eventId);
      expect(failureResult.rows[0].retry_count).toBe(0);
      expect(failureResult.rows[0].error_message).toContain('Organization ID not found');

      const failureId = failureResult.rows[0].id;

      // Fix the webhook payload and retry
      webhookEvent.data.object.metadata.organization_id = TEST_ORG_ID;
      
      // Update the failure record with corrected payload
      await dbClient.query(
        'UPDATE payments.webhook_failures SET payload = $1 WHERE id = $2',
        [JSON.stringify(webhookEvent), failureId]
      );

      // Retry the webhook
      const retryResponse = await request(app.getHttpServer())
        .post(`/api/payments/webhook/retry/${failureId}`)
        .send();

      expect(retryResponse.status).toBe(201);
      expect(retryResponse.body.success).toBe(true);
      expect(retryResponse.body.message).toBe('Webhook retried successfully');

      // Verify retry count was updated
      const updatedFailureResult = await dbClient.query(
        'SELECT retry_count FROM payments.webhook_failures WHERE id = $1',
        [failureId]
      );
      expect(updatedFailureResult.rows[0].retry_count).toBe(1);
    });

    it('should handle retry of non-existent failure', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/payments/webhook/retry/99999')
        .send();

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Webhook failure not found');
    });

    it('should record multiple failures for same event', async () => {
      const eventId = 'evt_test_multi_failure_' + Date.now();
      const sessionId = 'cs_test_multi_failure_' + Date.now();
      const webhookEvent = createStripeEvent(eventId, sessionId);
      webhookEvent.data.object.metadata.organization_id = 'invalid-org-id';

      // Send the same failing webhook multiple times
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post('/api/payments/webhook')
          .set('stripe-signature', 'test')
          .set('Content-Type', 'application/json')
          .send(webhookEvent);
      }

      // Should have one failure record with retry_count = 2 (0 initial + 2 retries)
      const failureResult = await dbClient.query(
        'SELECT retry_count FROM payments.webhook_failures WHERE event_id = $1',
        [eventId]
      );
      expect(failureResult.rows).toHaveLength(1);
      expect(failureResult.rows[0].retry_count).toBe(2);
    });
  });

  describe('Event Processing', () => {
    it('should process valid checkout.session.completed event', async () => {
      const eventId = 'evt_test_valid_' + Date.now();
      const sessionId = 'cs_test_valid_' + Date.now();
      const webhookEvent = createStripeEvent(eventId, sessionId);

      const response = await request(app.getHttpServer())
        .post('/api/payments/webhook')
        .set('stripe-signature', 'test')
        .set('Content-Type', 'application/json')
        .send(webhookEvent);

      expect(response.status).toBe(201);
      expect(response.body.received).toBe(true);

      // Verify event was recorded
      const eventResult = await dbClient.query(
        'SELECT * FROM payments.webhook_events WHERE event_id = $1',
        [eventId]
      );
      expect(eventResult.rows).toHaveLength(1);
    });

    it('should handle unknown event types gracefully', async () => {
      const eventId = 'evt_test_unknown_' + Date.now();
      const sessionId = 'cs_test_unknown_' + Date.now();
      const webhookEvent = createStripeEvent(eventId, sessionId, 'unknown.event.type');

      const response = await request(app.getHttpServer())
        .post('/api/payments/webhook')
        .set('stripe-signature', 'test')
        .set('Content-Type', 'application/json')
        .send(webhookEvent);

      expect(response.status).toBe(201);
      expect(response.body.received).toBe(true);

      // Event should still be recorded even if not processed
      const eventResult = await dbClient.query(
        'SELECT * FROM payments.webhook_events WHERE event_id = $1',
        [eventId]
      );
      expect(eventResult.rows).toHaveLength(1);
    });
  });
});