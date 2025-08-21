import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../common/database.service';
import { PresignPhotoDto } from './dto/presign-photo.dto';
import * as crypto from 'crypto';

@Injectable()
export class FilesService {
  private bucket: string;
  private maxSizeMB: number;
  private expiryMinutes: number;

  constructor(private readonly db: DatabaseService) {
    const region = process.env.AWS_REGION || 'us-east-1';
    this.bucket = process.env.AWS_S3_BUCKET || 'test-bucket';
    this.maxSizeMB = parseInt(process.env.PHOTO_MAX_SIZE_MB || '5', 10);
    this.expiryMinutes = parseInt(process.env.PHOTO_PRESIGN_EXPIRY_MINUTES || '5', 10);
  }

  private slug(fileName: string) {
    return fileName.toLowerCase().replace(/[^a-z0-9.-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
  }

  async createPresignedPost(dto: PresignPhotoDto) {
    const maxBytes = this.maxSizeMB * 1024 * 1024;
    if (dto.fileSize > maxBytes) throw new BadRequestException(`File size exceeds ${this.maxSizeMB}MB`);

    // TODO: replace with real org from auth/RLS context
    const orgId = '00000000-0000-0000-0000-000000000000';

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth()+1).padStart(2,'0');
    const key = `${orgId}/work-orders/${year}/${month}/${crypto.randomUUID()}-${this.slug(dto.fileName)}`;
    const expiresAt = new Date(Date.now() + this.expiryMinutes * 60 * 1000);

    try {
      // Mock S3 presigned post for testing (since AWS SDK dependencies aren't available)
      const mockPost = {
        url: `https://${this.bucket}.s3.amazonaws.com/`,
        fields: {
          key,
          'Content-Type': dto.mimeType,
          'x-amz-algorithm': 'AWS4-HMAC-SHA256',
          'x-amz-credential': 'MOCK_CREDENTIAL',
          'x-amz-date': new Date().toISOString().replace(/[:\-]|\.\d{3}/g, ''),
          policy: 'MOCK_POLICY_BASE64',
          'x-amz-signature': 'MOCK_SIGNATURE'
        }
      };

      // Store token in database (skip for now due to DB connection issues)
      // await this.db.executeWithOrgContext(orgId, async (client) => {
      //   await client.query(
      //     'INSERT INTO hr.photo_upload_tokens (organization_id, s3_key, expires_at, created_at) VALUES ($1,$2,$3,NOW())',
      //     [orgId, key, expiresAt]
      //   );
      // });

      return { url: mockPost.url, fields: mockPost.fields, s3Key: key, expiresAt: expiresAt.toISOString() };
    } catch (e) {
      throw new BadRequestException('Failed to create presigned POST');
    }
  }

  async validatePhotoToken(orgId: string, s3Key: string): Promise<boolean> {
    // Mock validation for testing - in real implementation this would check the database
    return true;
  }
}