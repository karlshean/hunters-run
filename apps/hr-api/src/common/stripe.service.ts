import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Mock Stripe types for development
interface StripeSession {
  id: string;
  url: string;
}

interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      amount_total?: number;
      metadata?: Record<string, string>;
    };
  };
}

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: any; // Will be actual Stripe instance when SDK is installed

  constructor(private readonly config: ConfigService) {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY');
    
    // For demo purposes, we'll simulate Stripe functionality
    // In production, this would be: this.stripe = new Stripe(secretKey);
    this.logger.warn('Using mock Stripe implementation - install stripe package for production use');
  }

  async createCheckoutSession(params: {
    amount: number;
    currency: string;
    metadata: Record<string, string>;
    successUrl?: string;
    cancelUrl?: string;
  }): Promise<StripeSession> {
    // Mock implementation - generates test session
    const sessionId = `cs_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.logger.log(`Creating mock checkout session: ${sessionId} for $${params.amount / 100}`);
    
    return {
      id: sessionId,
      url: `https://checkout.stripe.com/c/pay/${sessionId}#fidkdWxOYHwnPyd1blpxYHZxWjA0SF1gYTdPMDVKXDN1NGJ3RGtnXHZnZU9RPUFLUVJPa19iXUh1ZG5VbXFDYkpKXE5dY19LZE9rVFRiNUhyUGJsRG9nZktTYX1iRDdJT2BOdDdcaGhONUdCTXZENmhPQUQ0TkcwdCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPydocGlxbFpscWBoJyknYGtkZ2lgVWlkZmBtamlhYHd2Jz9xd3BgeCUl`
    };
  }

  constructEventFromPayload(payload: string | Buffer, signature: string, secret: string): StripeEvent {
    const allowInsecureTest = this.config.get<boolean>('ALLOW_INSECURE_STRIPE_WEBHOOK_TEST');
    
    // Development bypass for testing
    if (allowInsecureTest && signature === 'test-skip') {
      this.logger.warn('Using insecure webhook bypass - only for development!');
      try {
        return JSON.parse(payload.toString());
      } catch (error) {
        throw new Error('Invalid JSON payload');
      }
    }
    
    // In production with real Stripe SDK:
    // return this.stripe.webhooks.constructEvent(payload, signature, secret);
    
    // Mock validation for demo
    throw new Error('Stripe SDK not installed - use ALLOW_INSECURE_STRIPE_WEBHOOK_TEST=true for testing');
  }

  validateWebhookSignature(payload: string | Buffer, signature: string): boolean {
    const allowInsecureTest = this.config.get<boolean>('ALLOW_INSECURE_STRIPE_WEBHOOK_TEST');
    
    if (allowInsecureTest && signature === 'test-skip') {
      return true;
    }
    
    // Mock validation - in production this would use actual Stripe signature validation
    return false;
  }
}