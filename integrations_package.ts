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
  getPaymentStatus(pay