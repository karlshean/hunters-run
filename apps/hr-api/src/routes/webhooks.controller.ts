import { Controller, Post, Req, Headers } from "@nestjs/common";
import Stripe from "stripe";
import { AppDataSource } from "@platform/db/src/datasource";

@Controller()
export class WebhooksController {
  @Post("api/payments/webhook")
  async stripe(@Req() req: any, @Headers("stripe-signature") sig?: string) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return { ok: false, error: "no_webhook_secret" };
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2024-06-20" as any });
    let event: Stripe.Event;
    try {
      const raw = Buffer.isBuffer(req.body) ? req.body : req.rawBody;
      event = stripe.webhooks.constructEvent(raw, sig!, secret);
    } catch (e:any) {
      return { ok: false, error: "sig_verify_failed" };
    }
    await AppDataSource.query(
      "insert into hr.webhook_events(provider, event_id, payload) values($1,$2,$3) on conflict (provider,event_id) do nothing",
      ['stripe', event.id, event as any]
    );
    if (event.type === "charge.dispute.created") {
      const d: any = event.data.object;
      await AppDataSource.query(
        `insert into hr.payment_disputes(stripe_dispute_id, organization_id, charge_id, reason, amount_cents, status)
         values($1, $2, $3, $4, $5, $6)
         on conflict (stripe_dispute_id) do update set status=excluded.status`,
        [d.id, null, d.charge, d.reason, d.amount, d.status]
      );
    }
    return { ok: true };
  }
}