import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../common/database.service';
import { PresignPhotoDto } from './dto/presign-photo.dto';
import * as crypto from 'crypto';

interface S3PostPolicyResult {
  url: string;
  fields: Record<string, string>;
  s3Key: string;
  expires: Date;
}

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  async presignPhoto(orgId: string, dto: PresignPhotoDto): Promise<S3PostPolicyResult> {
    // For demo organization, return mock presigned URL
    if (orgId === '00000000-0000-4000-8000-000000000001') {
      const mockS3Key = `demo-org/work-orders/2025/01/${crypto.randomUUID()}-${this.slugifyFilename(dto.fileName)}`;
      return {
        url: 'https://demo-bucket.s3.amazonaws.com/',
        fields: {
          key: mockS3Key,
          'Content-Type': dto.mimeType,
          'Content-Length-Range': `1,${dto.fileSize}`,
          'x-amz-date': new Date().toISOString().replace(/[:\-]|\.\d{3}/g, ''),
          policy: 'demo-policy-base64',
          'x-amz-credential': 'demo-credentials',
          'x-amz-algorithm': 'AWS4-HMAC-SHA256',
          'x-amz-signature': 'demo-signature'
        },
        s3Key: mockS3Key,
        expires: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
      };
    }

    // Validate file constraints
    if (dto.fileSize > 5 * 1024 * 1024) {
      throw new Error('File size cannot exceed 5MB');
    }

    const supportedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!supportedTypes.includes(dto.mimeType)) {
      throw new Error('Unsupported file type');
    }

    // Generate S3 key with pattern: ${orgId}/work-orders/${yyyy}/${mm}/${uuid}-${slug(fileName)}
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const uuid = crypto.randomUUID();
    const slug = this.slugifyFilename(dto.fileName);
    const s3Key = `${orgId}/work-orders/${year}/${month}/${uuid}-${slug}`;

    // Generate presigned POST policy
    const result = await this.generateS3PostPolicy(s3Key, dto);

    // Store token in database for validation
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await this.storePhotoToken(orgId, s3Key, expires);

    return {
      ...result,
      s3Key,
      expires
    };
  }

  private async generateS3PostPolicy(s3Key: string, dto: PresignPhotoDto): Promise<{ url: string; fields: Record<string, string> }> {
    const bucketName = this.config.get('AWS_S3_BUCKET', 'hunters-run-files');
    const region = this.config.get('AWS_REGION', 'us-east-1');
    const accessKeyId = this.config.get('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get('AWS_SECRET_ACCESS_KEY');

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('AWS credentials not configured');
    }

    const expiration = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes
    const date = new Date();
    const dateStamp = date.toISOString().slice(0, 10).replace(/-/g, '');
    const amzDate = date.toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const credential = `${accessKeyId}/${dateStamp}/${region}/s3/aws4_request`;

    // Create policy document
    const policy = {
      expiration,
      conditions: [
        { bucket: bucketName },
        { key: s3Key },
        { 'Content-Type': dto.mimeType },
        ['content-length-range', 1, dto.fileSize],
        { 'x-amz-algorithm': 'AWS4-HMAC-SHA256' },
        { 'x-amz-credential': credential },
        { 'x-amz-date': amzDate }
      ]
    };

    const policyBase64 = Buffer.from(JSON.stringify(policy)).toString('base64');

    // Generate signature
    const signature = this.generateSignature(
      secretAccessKey,
      dateStamp,
      region,
      policyBase64
    );

    return {
      url: `https://${bucketName}.s3.${region}.amazonaws.com/`,
      fields: {
        key: s3Key,
        'Content-Type': dto.mimeType,
        'x-amz-algorithm': 'AWS4-HMAC-SHA256',
        'x-amz-credential': credential,
        'x-amz-date': amzDate,
        policy: policyBase64,
        'x-amz-signature': signature
      }
    };
  }

  private generateSignature(secretKey: string, dateStamp: string, region: string, policyBase64: string): string {
    const kDate = crypto.createHmac('sha256', 'AWS4' + secretKey).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update('s3').digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    return crypto.createHmac('sha256', kSigning).update(policyBase64).digest('hex');
  }

  private async storePhotoToken(orgId: string, s3Key: string, expires: Date): Promise<void> {
    try {
      await this.db.executeWithOrgContext(orgId, async (client) => {
        await client.query(`
          INSERT INTO hr.photo_upload_tokens (organization_id, s3_key, expires_at)
          VALUES ($1, $2, $3)
        `, [orgId, s3Key, expires]);
      });
    } catch (error) {
      this.logger.error(`Failed to store photo token: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new Error('Failed to store upload token');
    }
  }

  async validatePhotoToken(orgId: string, s3Key: string): Promise<boolean> {
    try {
      const result = await this.db.executeWithOrgContext(orgId, async (client) => {
        return await client.query(`
          SELECT id FROM hr.photo_upload_tokens 
          WHERE organization_id = $1 AND s3_key = $2 AND expires_at > NOW()
        `, [orgId, s3Key]);
      });
      
      return result.rows.length > 0;
    } catch (error) {
      this.logger.error(`Failed to validate photo token: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  async cleanupExpiredTokens(): Promise<void> {
    try {
      // This cleanup doesn't need organization context as it's a global cleanup
      const client = await this.db.getClient();
      try {
        await client.query(`
          DELETE FROM hr.photo_upload_tokens 
          WHERE expires_at < NOW()
        `);
      } finally {
        await client.end();
      }
    } catch (error) {
      this.logger.error(`Failed to cleanup expired tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private slugifyFilename(filename: string): string {
    // Extract extension
    const lastDot = filename.lastIndexOf('.');
    const name = lastDot > 0 ? filename.slice(0, lastDot) : filename;
    const ext = lastDot > 0 ? filename.slice(lastDot) : '';
    
    // Slugify name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50); // Limit length
    
    return slug + ext;
  }
}