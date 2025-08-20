// packages/integrations/package.json
{
  "name": "@hunters-run/integrations",
  "version": "1.0.0",
  "description": "External service integrations and adapters",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "lint": "eslint src/**/*.ts"
  },
  "dependencies": {
    "@sendgrid/mail": "^7.7.0",
    "aws-sdk": "^2.1400.0",
    "stripe": "^12.15.0",
    "firebase-admin": "^11.10.0",
    "axios": "^1.4.0"
  },
  "devDependencies": {
    "typescript": "^5.1.3",
    "@types/node": "^20.3.1",
    "jest": "^29.5.0",
    "@types/jest": "^29.5.2"
  }
}

// packages/integrations/src/index.ts
export * from './email';
export * from './sms';
export * from './files';
export * from './payments';
export * from './auth';

// packages/integrations/src/email/types.ts
export interface EmailProvider {
  sendEmail(params: SendEmailParams): Promise<EmailResult>;
  sendBulkEmail(params: BulkEmailParams): Promise<EmailResult[]>;
  validateEmail(email: string): Promise<boolean>;
}

export interface SendEmailParams {
  to: string | string[];
  from: string;
  subject: string;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
  templateId?: string;
  templateData?: Record<string, any>;
}

export interface BulkEmailParams {
  emails: SendEmailParams[];
  batchSize?: number;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType: string;
}

export interface EmailResult {
  messageId: string;
  success: boolean;
  error?: string;
}

// packages/integrations/src/email/sendgrid.adapter.ts
import sgMail from '@sendgrid/mail';
import { EmailProvider, SendEmailParams, BulkEmailParams, EmailResult } from './types';

export class SendGridAdapter implements EmailProvider {
  constructor(private apiKey: string) {
    sgMail.setApiKey(apiKey);
  }

  async sendEmail(params: SendEmailParams): Promise<EmailResult> {
    try {
      const msg = {
        to: params.to,
        from: params.from,
        subject: params.subject,
        html: params.html,
        text: params.text,
        attachments: params.attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
          type: att.contentType,
        })),
        templateId: params.templateId,
        dynamicTemplateData: params.templateData,
      };

      const [response] = await sgMail.send(msg);
      
      return {
        messageId: response.headers['x-message-id'] || 'unknown',
        success: true,
      };
    } catch (error) {
      return {
        messageId: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendBulkEmail(params: BulkEmailParams): Promise<EmailResult[]> {
    const results: EmailResult[] = [];
    const batchSize = params.batchSize || 100;
    
    for (let i = 0; i < params.emails.length; i += batchSize) {
      const batch = params.emails.slice(i, i + batchSize);
      const batchPromises = batch.map(email => this.sendEmail(email));
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            messageId: '',
            success: false,
            error: result.reason?.message || 'Batch send failed',
          });
        }
      });
    }
    
    return results;
  }

  async validateEmail(email: string): Promise<boolean> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

// packages/integrations/src/sms/types.ts
export interface SMSProvider {
  sendSMS(params: SendSMSParams): Promise<SMSResult>;
  sendBulkSMS(params: BulkSMSParams): Promise<SMSResult[]>;
  validatePhoneNumber(phone: string): Promise<boolean>;
}

export interface SendSMSParams {
  to: string;
  from: string;
  message: string;
  mediaUrls?: string[];
}

export interface BulkSMSParams {
  messages: SendSMSParams[];
  batchSize?: number;
}

export interface SMSResult {
  messageId: string;
  success: boolean;
  error?: string;
  cost?: number;
}

// packages/integrations/src/sms/telnyx.adapter.ts
import axios from 'axios';
import { SMSProvider, SendSMSParams, BulkSMSParams, SMSResult } from './types';

export class TelnyxAdapter implements SMSProvider {
  private baseUrl = 'https://api.telnyx.com/v2';
  
  constructor(private apiKey: string) {}

  async sendSMS(params: SendSMSParams): Promise<SMSResult> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/messages`,
        {
          from: params.from,
          to: params.to,
          text: params.message,
          media_urls: params.mediaUrls,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        messageId: response.data.data.id,
        success: true,
        cost: response.data.data.cost?.amount,
      };
    } catch (error: any) {
      return {
        messageId: '',
        success: false,
        error: error.response?.data?.errors?.[0]?.detail || error.message,
      };
    }
  }

  async sendBulkSMS(params: BulkSMSParams): Promise<SMSResult[]> {
    const results: SMSResult[] = [];
    const batchSize = params.batchSize || 50;
    
    for (let i = 0; i < params.messages.length; i += batchSize) {
      const batch = params.messages.slice(i, i + batchSize);
      const batchPromises = batch.map(sms => this.sendSMS(sms));
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            messageId: '',
            success: false,
            error: result.reason?.message || 'Batch send failed',
          });
        }
      });
      
      // Rate limiting - wait between batches
      if (i + batchSize < params.messages.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  async validatePhoneNumber(phone: string): Promise<boolean> {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone.replace(/\s+/g, ''));
  }
}

// packages/integrations/src/files/types.ts
export interface FileProvider {
  upload(params: UploadParams): Promise<UploadResult>;
  download(key: string): Promise<DownloadResult>;
  delete(key: string): Promise<boolean>;
  generateSignedUrl(key: string, operation: 'get' | 'put', expiresIn?: number): Promise<string>;
  getMetadata(key: string): Promise<FileMetadata>;
}

export interface UploadParams {
  key: string;
  buffer: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
  public?: boolean;
}

export interface UploadResult {
  key: string;
  url: string;
  etag: string;
  size: number;
  success: boolean;
  error?: string;
}

export interface DownloadResult {
  buffer: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
  success: boolean;
  error?: string;
}

export interface FileMetadata {
  key: string;
  size: number;
  contentType: string;
  lastModified: Date;
  etag: string;
  metadata?: Record<string, string>;
}

// packages/integrations/src/files/s3.adapter.ts
import { S3 } from 'aws-sdk';
import { FileProvider, UploadParams, UploadResult, DownloadResult, FileMetadata } from './types';

export class S3Adapter implements FileProvider {
  private s3: S3;
  
  constructor(
    private bucket: string,
    private region: string,
    accessKeyId: string,
    secretAccessKey: string
  ) {
    this.s3 = new S3({
      region,
      accessKeyId,
      secretAccessKey,
    });
  }

  async upload(params: UploadParams): Promise<UploadResult> {
    try {
      const uploadParams = {
        Bucket: this.bucket,
        Key: params.key,
        Body: params.buffer,
        ContentType: params.contentType,
        Metadata: params.metadata,
        ACL: params.public ? 'public-read' : 'private',
      };

      const result = await this.s3.upload(uploadParams).promise();
      
      return {
        key: params.key,
        url: result.Location,
        etag: result.ETag || '',
        size: params.buffer.length,
        success: true,
      };
    } catch (error) {
      return {
        key: params.key,
        url: '',
        etag: '',
        size: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  async download(key: string): Promise<DownloadResult> {
    try {
      const result = await this.s3.getObject({
        Bucket: this.bucket,
        Key: key,
      }).promise();

      return {
        buffer: result.Body as Buffer,
        contentType: result.ContentType || 'application/octet-stream',
        metadata: result.Metadata,
        success: true,
      };
    } catch (error) {
      return {
        buffer: Buffer.alloc(0),
        contentType: '',
        success: false,
        error: error instanceof Error ? error.message : 'Download failed',
      };
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      await this.s3.deleteObject({
        Bucket: this.bucket,
        Key: key,
      }).promise();
      
      return true;
    } catch (error) {
      return false;
    }
  }

  async generateSignedUrl(key: string, operation: 'get' | 'put', expiresIn = 3600): Promise<string> {
    const operationMap = {
      get: 'getObject',
      put: 'putObject',
    };

    return this.s3.getSignedUrl(operationMap[operation], {
      Bucket: this.bucket,
      Key: key,
      Expires: expiresIn,
    });
  }

  async getMetadata(key: string): Promise<FileMetadata> {
    const result = await this.s3.headObject({
      Bucket: this.bucket,
      Key: key,
    }).promise();

    return {
      key,
      size: result.ContentLength || 0,
      contentType: result.ContentType || '',
      lastModified: result.LastModified || new Date(),
      etag: result.ETag || '',
      metadata: result.Metadata,
    };
  }
}

// packages/integrations/src/payments/types.ts
export interface PaymentProvider {
  createPaymentIntent(params: CreatePaymentParams): Promise<PaymentResult>;
  confirmPayment(paymentIntentId: string): Promise<PaymentResult>;
  refundPayment(paymentIntentId: string, amount?: number): Promise<RefundResult>;
  getPaymentStatus(paymentIntentId: string): Promise<PaymentStatus>;
  createCustomer(params: CreateCustomerParams): Promise<CustomerResult>;
  attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<boolean>;
}

export interface CreatePaymentParams {
  amount: number; // in cents
  currency: string;
  customerId?: string;
  paymentMethodId?: string;
  description?: string;
  metadata?: Record<string, string>;
  captureMethod?: 'automatic' | 'manual';
}

export interface PaymentResult {
  paymentIntentId: string;
  clientSecret?: string;
  status: PaymentIntentStatus;
  success: boolean;
  error?: string;
  amount?: number;
  currency?: string;
  metadata?: Record<string, string>;
}

export interface RefundResult {
  refundId: string;
  amount: number;
  status: RefundStatus;
  success: boolean;
  error?: string;
}

export interface PaymentStatus {
  paymentIntentId: string;
  status: PaymentIntentStatus;
  amount: number;
  currency: string;
  created: Date;
  metadata?: Record<string, string>;
}

export interface CreateCustomerParams {
  email: string;
  name?: string;
  phone?: string;
  metadata?: Record<string, string>;
}

export interface CustomerResult {
  customerId: string;
  success: boolean;
  error?: string;
}

export type PaymentIntentStatus = 
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'requires_capture'
  | 'canceled'
  | 'succeeded';

export type RefundStatus = 'pending' | 'succeeded' | 'failed' | 'canceled';

// packages/integrations/src/payments/stripe.adapter.ts
import Stripe from 'stripe';
import { 
  PaymentProvider, 
  CreatePaymentParams, 
  PaymentResult, 
  RefundResult, 
  PaymentStatus,
  CreateCustomerParams,
  CustomerResult 
} from './types';

export class StripeAdapter implements PaymentProvider {
  private stripe: Stripe;

  constructor(secretKey: string) {
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2023-10-16',
    });
  }

  async createPaymentIntent(params: CreatePaymentParams): Promise<PaymentResult> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: params.amount,
        currency: params.currency,
        customer: params.customerId,
        payment_method: params.paymentMethodId,
        description: params.description,
        metadata: params.metadata,
        capture_method: params.captureMethod || 'automatic',
        confirm: !!params.paymentMethodId,
      });

      return {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret || undefined,
        status: paymentIntent.status as any,
        success: true,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        metadata: paymentIntent.metadata,
      };
    } catch (error) {
      return {
        paymentIntentId: '',
        status: 'canceled',
        success: false,
        error: error instanceof Error ? error.message : 'Payment creation failed',
      };
    }
  }

  async confirmPayment(paymentIntentId: string): Promise<PaymentResult> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId);

      return {
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status as any,
        success: paymentIntent.status === 'succeeded',
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        metadata: paymentIntent.metadata,
      };
    } catch (error) {
      return {
        paymentIntentId,
        status: 'canceled',
        success: false,
        error: error instanceof Error ? error.message : 'Payment confirmation failed',
      };
    }
  }

  async refundPayment(paymentIntentId: string, amount?: number): Promise<RefundResult> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount,
      });

      return {
        refundId: refund.id,
        amount: refund.amount,
        status: refund.status as any,
        success: refund.status === 'succeeded',
      };
    } catch (error) {
      return {
        refundId: '',
        amount: amount || 0,
        status: 'failed',
        success: false,
        error: error instanceof Error ? error.message : 'Refund failed',
      };
    }
  }

  async getPaymentStatus(paymentIntentId: string): Promise<PaymentStatus> {
    const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

    return {
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status as any,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      created: new Date(paymentIntent.created * 1000),
      metadata: paymentIntent.metadata,
    };
  }

  async createCustomer(params: CreateCustomerParams): Promise<CustomerResult> {
    try {
      const customer = await this.stripe.customers.create({
        email: params.email,
        name: params.name,
        phone: params.phone,
        metadata: params.metadata,
      });

      return {
        customerId: customer.id,
        success: true,
      };
    } catch (error) {
      return {
        customerId: '',
        success: false,
        error: error instanceof Error ? error.message : 'Customer creation failed',
      };
    }
  }

  async attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<boolean> {
    try {
      await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}

// packages/integrations/src/auth/types.ts
export interface AuthProvider {
  verifyToken(token: string): Promise<TokenResult>;
  createCustomToken(uid: string, claims?: Record<string, any>): Promise<string>;
  getUserByEmail(email: string): Promise<UserRecord | null>;
  createUser(params: CreateUserParams): Promise<UserRecord>;
  updateUser(uid: string, params: UpdateUserParams): Promise<UserRecord>;
  deleteUser(uid: string): Promise<boolean>;
}

export interface TokenResult {
  uid: string;
  email?: string;
  email_verified?: boolean;
  phone_number?: string;
  custom_claims?: Record<string, any>;
  success: boolean;
  error?: string;
}

export interface UserRecord {
  uid: string;
  email?: string;
  email_verified?: boolean;
  phone_number?: string;
  display_name?: string;
  photo_url?: string;
  disabled?: boolean;
  metadata?: {
    creation_time?: string;
    last_sign_in_time?: string;
  };
  custom_claims?: Record<string, any>;
}

export interface CreateUserParams {
  email?: string;
  phone_number?: string;
  password?: string;
  display_name?: string;
  photo_url?: string;
  email_verified?: boolean;
  disabled?: boolean;
}

export interface UpdateUserParams {
  email?: string;
  phone_number?: string;
  password?: string;
  display_name?: string;
  photo_url?: string;
  email_verified?: boolean;
  disabled?: boolean;
  custom_claims?: Record<string, any>;
}

// packages/integrations/src/auth/firebase.adapter.ts
import * as admin from 'firebase-admin';
import { 
  AuthProvider, 
  TokenResult, 
  UserRecord, 
  CreateUserParams, 
  UpdateUserParams 
} from './types';

export class FirebaseAuthAdapter implements AuthProvider {
  private auth: admin.auth.Auth;

  constructor(
    projectId: string,
    privateKey: string,
    clientEmail: string
  ) {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          privateKey: privateKey.replace(/\\n/g, '\n'),
          clientEmail,
        }),
      });
    }
    
    this.auth = admin.auth();
  }

  async verifyToken(token: string): Promise<TokenResult> {
    try {
      const decodedToken = await this.auth.verifyIdToken(token);
      
      return {
        uid: decodedToken.uid,
        email: decodedToken.email,
        email_verified: decodedToken.email_verified,
        phone_number: decodedToken.phone_number,
        custom_claims: decodedToken,
        success: true,
      };
    } catch (error) {
      return {
        uid: '',
        success: false,
        error: error instanceof Error ? error.message : 'Token verification failed',
      };
    }
  }

  async createCustomToken(uid: string, claims?: Record<string, any>): Promise<string> {
    return this.auth.createCustomToken(uid, claims);
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    try {
      const userRecord = await this.auth.getUserByEmail(email);
      return this.mapUserRecord(userRecord);
    } catch (error) {
      return null;
    }
  }

  async createUser(params: CreateUserParams): Promise<UserRecord> {
    const userRecord = await this.auth.createUser(params);
    return this.mapUserRecord(userRecord);
  }

  async updateUser(uid: string, params: UpdateUserParams): Promise<UserRecord> {
    const userRecord = await this.auth.updateUser(uid, params);
    return this.mapUserRecord(userRecord);
  }

  async deleteUser(uid: string): Promise<boolean> {
    try {
      await this.auth.deleteUser(uid);
      return true;
    } catch (error) {
      return false;
    }
  }

  private mapUserRecord(record: admin.auth.UserRecord): UserRecord {
    return {
      uid: record.uid,
      email: record.email,
      email_verified: record.emailVerified,
      phone_number: record.phoneNumber,
      display_name: record.displayName,
      photo_url: record.photoURL,
      disabled: record.disabled,
      metadata: {
        creation_time: record.metadata.creationTime,
        last_sign_in_time: record.metadata.lastSignInTime,
      },
      custom_claims: record.customClaims,
    };
  }
}