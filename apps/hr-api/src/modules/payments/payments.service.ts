import { Injectable, NotFoundException, BadRequestException, UnprocessableEntityException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../common/database.service';
import { StripeService } from '../../common/stripe.service';
import { AuditService } from '../../common/audit.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

export interface Charge {
  id: string;
  organizationId: string;
  tenantId: string;
  description: string;
  amountCents: number;
  currency: string;
  dueDate: string;
  status: string;
  allocatedCents: number;
  remainingCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  organizationId: string;
  tenantId: string;
  provider: string;
  providerPaymentId: string;
  amountCents: number;
  currency: string;
  receivedAt: string | null;
  status: string;
  createdAt: string;
}

export interface CheckoutResponse {
  url: string;
  sessionId: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly stripe: StripeService,
    private readonly auditService: AuditService
  ) {}

  async createCheckout(orgId: string, dto: CreateCheckoutDto): Promise<CheckoutResponse> {
    return this.db.executeWithOrgContext(orgId, async (client) => {
      // Validate tenant exists
      const tenantCheck = await client.query(
        'SELECT id FROM hr.tenants WHERE id = $1',
        [dto.tenantId]
      );
      
      if (tenantCheck.rows.length === 0) {
        throw new NotFoundException('Tenant not found');
      }

      let amountCents = dto.amountCents;
      let chargeId = dto.chargeId;

      // If chargeId provided, validate and use charge amount
      if (dto.chargeId) {
        const chargeResult = await client.query(`
          SELECT c.id, c.amount_cents, 
                 COALESCE(SUM(a.amount_cents), 0) as allocated_cents
          FROM payments.charges c
          LEFT JOIN payments.allocations a ON c.id = a.charge_id
          WHERE c.id = $1
          GROUP BY c.id, c.amount_cents
        `, [dto.chargeId]);

        if (chargeResult.rows.length === 0) {
          throw new NotFoundException('Charge not found');
        }

        const charge = chargeResult.rows[0];
        const remainingCents = charge.amount_cents - charge.allocated_cents;
        
        if (remainingCents <= 0) {
          throw new BadRequestException('Charge is already fully paid');
        }

        amountCents = remainingCents;
        chargeId = charge.id;
      } else if (!dto.amountCents) {
        throw new BadRequestException('Either chargeId or amountCents must be provided');
      }

      if (!amountCents || amountCents < 1) {
        throw new UnprocessableEntityException('Amount must be at least 1 cent');
      }

      // Create Stripe checkout session
      const session = await this.stripe.createCheckoutSession({
        amount: amountCents,
        currency: dto.currency || 'usd',
        metadata: {
          orgId,
          tenantId: dto.tenantId,
          ...(chargeId && { chargeId })
        }
      });

      // Create payment record
      const paymentResult = await client.query(`
        INSERT INTO payments.payments (
          organization_id, tenant_id, provider, provider_payment_id, 
          amount_cents, currency, status, created_at
        )
        VALUES ($1, $2, 'stripe', $3, $4, $5, 'pending', NOW())
        RETURNING id
      `, [orgId, dto.tenantId, session.id, amountCents, dto.currency || 'usd']);

      const paymentId = paymentResult.rows[0].id;

      // Create H5 audit log entry
      await this.auditService.log({
        orgId,
        action: 'payment.checkout_created',
        entity: 'payment',
        entityId: paymentId,
        metadata: {
          sessionId: session.id,
          amountCents,
          currency: dto.currency || 'usd',
          tenantId: dto.tenantId,
          ...(chargeId && { chargeId })
        }
      });

      this.logger.log(`Checkout created: ${session.id} for $${amountCents / 100}`);

      return {
        url: session.url,
        sessionId: session.id
      };
    });
  }

  async recordWebhookEvent(event: any): Promise<boolean> {
    // Global webhook event recording (not org-scoped)
    const client = await this.db.getClient();
    try {
      await client.query('BEGIN');
      
      // Upsert webhook event - if duplicate, return true without side effects
      const result = await client.query(`
        INSERT INTO payments.webhook_events (provider, event_id, received_at, payload)
        VALUES ('stripe', $1, NOW(), $2)
        ON CONFLICT (provider, event_id) DO NOTHING
        RETURNING event_id
      `, [event.id, JSON.stringify(event)]);
      
      await client.query('COMMIT');
      
      // If no rows returned, it was a duplicate
      return result.rows.length === 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      await client.end();
    }
  }

  async recordWebhookFailure(event: any, errorMessage: string, errorStack?: string): Promise<void> {
    const client = await this.db.getClient();
    try {
      await client.query('BEGIN');
      
      await client.query(`
        INSERT INTO payments.webhook_failures (provider, event_id, payload, error_message, error_stack, retry_count, created_at)
        VALUES ('stripe', $1, $2, $3, $4, 0, NOW())
        ON CONFLICT (provider, event_id) DO UPDATE SET
          error_message = EXCLUDED.error_message,
          error_stack = EXCLUDED.error_stack,
          retry_count = webhook_failures.retry_count + 1,
          last_retry_at = NOW()
      `, [event.id, JSON.stringify(event), errorMessage, errorStack]);
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      await client.end();
    }
  }

  async retryWebhookFailure(failureId: string): Promise<{ success: boolean; message: string }> {
    const client = await this.db.getClient();
    try {
      await client.query('BEGIN');
      
      // Get the failed webhook
      const failureResult = await client.query(`
        SELECT provider, event_id, payload, retry_count
        FROM payments.webhook_failures 
        WHERE id = $1
      `, [failureId]);

      if (failureResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, message: 'Webhook failure not found' };
      }

      const failure = failureResult.rows[0];
      const event = JSON.parse(failure.payload);

      // Extract org ID from event metadata
      let orgId: string | undefined;
      if (event.data?.object?.metadata?.organization_id) {
        orgId = event.data.object.metadata.organization_id;
      } else if (event.data?.object?.metadata?.orgId) {
        orgId = event.data.object.metadata.orgId;
      }

      if (!orgId) {
        await client.query('ROLLBACK');
        return { success: false, message: 'Organization ID not found in webhook metadata' };
      }

      try {
        // Process the webhook
        await this.processWebhook(orgId, event);

        // Update retry count on success
        await client.query(`
          UPDATE payments.webhook_failures 
          SET retry_count = retry_count + 1, last_retry_at = NOW()
          WHERE id = $1
        `, [failureId]);

        await client.query('COMMIT');

        this.logger.log(`Successfully retried webhook failure ${failureId} for event ${event.id}`);
        
        return { success: true, message: 'Webhook retried successfully' };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Webhook retry failed for ${failureId}: ${message}`);
        
        // Update retry count even on failure
        await client.query(`
          UPDATE payments.webhook_failures 
          SET retry_count = retry_count + 1, last_retry_at = NOW()
          WHERE id = $1
        `, [failureId]);
        
        await client.query('COMMIT');
        
        return { success: false, message: `Retry failed: ${message}` };
      }
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      await client.end();
    }
  }

  async processWebhook(orgId: string, event: any): Promise<void> {
    return this.db.executeWithOrgContext(orgId, async (client) => {
      if (event.type === 'checkout.session.completed') {
        await this.handleCheckoutCompleted(client, orgId, event.data.object);
      }
      // Add more event type handlers as needed
    });
  }

  private async handleCheckoutCompleted(client: any, orgId: string, session: any): Promise<void> {
    // Find payment by session ID
    const paymentResult = await client.query(`
      SELECT id, tenant_id, amount_cents 
      FROM payments.payments 
      WHERE provider_payment_id = $1 AND status = 'pending'
    `, [session.id]);

    if (paymentResult.rows.length === 0) {
      this.logger.warn(`No pending payment found for session: ${session.id}`);
      return;
    }

    const payment = paymentResult.rows[0];

    // Update payment status
    await client.query(`
      UPDATE payments.payments 
      SET status = 'succeeded', received_at = NOW() 
      WHERE id = $1
    `, [payment.id]);

    // Create H5 audit log entry for payment received
    await this.auditService.log({
      orgId,
      action: 'payment.received',
      entity: 'payment',
      entityId: payment.id,
      metadata: {
        sessionId: session.id,
        amountCents: payment.amount_cents,
        tenantId: payment.tenant_id
      }
    });

    // Perform oldest-first allocation
    await this.allocatePayment(client, orgId, payment);

    this.logger.log(`Payment processed: ${session.id} for $${payment.amount_cents / 100}`);
  }

  private async allocatePayment(client: any, orgId: string, payment: any): Promise<void> {
    let remainingAmount = payment.amount_cents;

    // Get unpaid charges for the tenant, ordered oldest first
    const chargesResult = await client.query(`
      SELECT c.id, c.amount_cents, c.description,
             COALESCE(SUM(a.amount_cents), 0) as allocated_cents
      FROM payments.charges c
      LEFT JOIN payments.allocations a ON c.id = a.charge_id
      WHERE c.tenant_id = $1 AND c.status IN ('unpaid', 'partially_paid')
      GROUP BY c.id, c.amount_cents, c.description, c.due_date, c.created_at
      HAVING c.amount_cents > COALESCE(SUM(a.amount_cents), 0)
      ORDER BY c.due_date ASC, c.created_at ASC
    `, [payment.tenant_id]);

    for (const charge of chargesResult.rows) {
      if (remainingAmount <= 0) break;

      const chargeBalance = charge.amount_cents - charge.allocated_cents;
      const allocationAmount = Math.min(remainingAmount, chargeBalance);

      // Create allocation
      await client.query(`
        INSERT INTO payments.allocations (organization_id, payment_id, charge_id, amount_cents)
        VALUES ($1, $2, $3, $4)
      `, [orgId, payment.id, charge.id, allocationAmount]);

      // Update charge status
      const newAllocatedTotal = charge.allocated_cents + allocationAmount;
      const newStatus = newAllocatedTotal >= charge.amount_cents ? 'paid' : 'partially_paid';
      
      await client.query(`
        UPDATE payments.charges 
        SET status = $1, updated_at = NOW() 
        WHERE id = $2
      `, [newStatus, charge.id]);

      // Create H5 audit log entry for allocation
      await this.auditService.log({
        orgId,
        action: 'allocation.created',
        entity: 'allocation',
        entityId: `${payment.id}-${charge.id}`, // Composite identifier for allocation
        metadata: {
          paymentId: payment.id,
          chargeId: charge.id,
          allocationAmount,
          newStatus,
          chargeDescription: charge.description
        }
      });

      remainingAmount -= allocationAmount;

      this.logger.log(`Allocated $${allocationAmount / 100} to charge ${charge.id} (${charge.description})`);
    }

    if (remainingAmount > 0) {
      this.logger.log(`Overpayment of $${remainingAmount / 100} left unallocated`);
    }
  }

  async getCharge(orgId: string, chargeId: string): Promise<Charge> {
    return this.db.executeWithOrgContext(orgId, async (client) => {
      const result = await client.query(`
        SELECT c.id, c.organization_id as "organizationId", c.tenant_id as "tenantId",
               c.description, c.amount_cents as "amountCents", c.currency, 
               c.due_date as "dueDate", c.status,
               c.created_at as "createdAt", c.updated_at as "updatedAt",
               COALESCE(SUM(a.amount_cents), 0) as "allocatedCents"
        FROM payments.charges c
        LEFT JOIN payments.allocations a ON c.id = a.charge_id
        WHERE c.id = $1
        GROUP BY c.id, c.organization_id, c.tenant_id, c.description, 
                 c.amount_cents, c.currency, c.due_date, c.status,
                 c.created_at, c.updated_at
      `, [chargeId]);

      if (result.rows.length === 0) {
        throw new NotFoundException('Charge not found');
      }

      const charge = result.rows[0];
      charge.remainingCents = charge.amountCents - charge.allocatedCents;

      return charge;
    });
  }
}