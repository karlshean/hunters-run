import { Injectable, NotFoundException, BadRequestException, UnprocessableEntityException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../common/database.service';
import { StripeService } from '../../common/stripe.service';
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
    private readonly stripe: StripeService
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

      // Create audit event
      await client.query(`
        SELECT hr.create_audit_event($1, 'checkout_created', 'payment', $2, $3)
      `, [
        orgId,
        paymentId,
        JSON.stringify({
          sessionId: session.id,
          amountCents,
          currency: dto.currency || 'usd',
          tenantId: dto.tenantId,
          ...(chargeId && { chargeId })
        })
      ]);

      this.logger.log(`Checkout created: ${session.id} for $${amountCents / 100}`);

      return {
        url: session.url,
        sessionId: session.id
      };
    });
  }

  async processWebhook(orgId: string, event: any): Promise<void> {
    return this.db.executeWithOrgContext(orgId, async (client) => {
      // Check for duplicate webhook
      const existingWebhook = await client.query(
        'SELECT id FROM payments.webhook_events WHERE provider = $1 AND event_id = $2',
        ['stripe', event.id]
      );

      if (existingWebhook.rows.length > 0) {
        this.logger.log(`Ignoring duplicate webhook: ${event.id}`);
        
        // Emit audit event for duplicate
        await client.query(`
          SELECT hr.create_audit_event($1, 'webhook_ignored_duplicate', 'webhook', $2, $3)
        `, [
          orgId,
          event.id,
          JSON.stringify({ eventType: event.type, providerId: event.id })
        ]);
        
        return;
      }

      // Store webhook event
      await client.query(`
        INSERT INTO payments.webhook_events (organization_id, provider, event_id, type, raw)
        VALUES ($1, 'stripe', $2, $3, $4)
      `, [orgId, event.id, event.type, JSON.stringify(event)]);

      if (event.type === 'checkout.session.completed') {
        await this.handleCheckoutCompleted(client, orgId, event.data.object);
      }
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

    // Create audit event for payment received
    await client.query(`
      SELECT hr.create_audit_event($1, 'payment_received', 'payment', $2, $3)
    `, [
      orgId,
      payment.id,
      JSON.stringify({
        sessionId: session.id,
        amountCents: payment.amount_cents,
        tenantId: payment.tenant_id
      })
    ]);

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

      // Create audit event for allocation
      await client.query(`
        SELECT hr.create_audit_event($1, 'allocation_created', 'charge', $2, $3)
      `, [
        orgId,
        charge.id,
        JSON.stringify({
          paymentId: payment.id,
          allocationAmount,
          newStatus,
          chargeDescription: charge.description
        })
      ]);

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