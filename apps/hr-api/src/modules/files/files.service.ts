import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../common/database.service';
import { PresignPhotoDto } from './dto/presign-photo.dto';
import * as crypto from 'crypto';
import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost, PresignedPostOptions } from '@aws-sdk/s3-presigned-post';

@Injectable()
export class FilesService {
  private bucket: string;
  private maxSizeMB: number;
  private expiryMinutes: number;
  private s3Client: S3Client;
  private region: string;

  constructor(private readonly db: DatabaseService) {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.bucket = process.env.AWS_S3_BUCKET || 'test-bucket';
    this.maxSizeMB = parseInt(process.env.PHOTO_MAX_SIZE_MB || '5', 10);
    this.expiryMinutes = parseInt(process.env.PHOTO_PRESIGN_EXPIRY_MINUTES || '5', 10);
    
    // Initialize S3 client
    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'mock-access-key',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'mock-secret-key'
      }
    });
  }

  private slug(fileName: string) {
    return fileName.toLowerCase().replace(/[^a-z0-9.-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
  }

  async createPresignedPost(orgId: string, dto: PresignPhotoDto) {
    const maxBytes = this.maxSizeMB * 1024 * 1024;
    if (dto.fileSize > maxBytes) throw new BadRequestException(`File size exceeds ${this.maxSizeMB}MB`);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth()+1).padStart(2,'0');
    const key = `${orgId}/work-orders/${year}/${month}/${crypto.randomUUID()}-${this.slug(dto.fileName)}`;
    const expiresAt = new Date(Date.now() + this.expiryMinutes * 60 * 1000);

    try {
      // Use real AWS S3 presigned post
      const presignedPostOptions: PresignedPostOptions = {
        Bucket: this.bucket,
        Key: key,
        Conditions: [
          ['content-length-range', 0, maxBytes],
          ['eq', '$Content-Type', dto.mimeType]
        ],
        Fields: {
          'Content-Type': dto.mimeType
        },
        Expires: this.expiryMinutes * 60 // seconds
      };

      const presignedPost = await createPresignedPost(this.s3Client, presignedPostOptions);

      // Store token in database (skip for demo)
      // await this.db.executeWithOrgContext(orgId, async (client) => {
      //   await client.query(
      //     'INSERT INTO hr.photo_upload_tokens (organization_id, s3_key, expires_at, created_at) VALUES ($1,$2,$3,NOW())',
      //     [orgId, key, expiresAt]
      //   );
      // });

      return { 
        url: presignedPost.url, 
        fields: presignedPost.fields, 
        s3Key: key, 
        expiresAt: expiresAt.toISOString() 
      };
    } catch (e) {
      console.error('Failed to create presigned POST:', e);
      throw new BadRequestException('Failed to create presigned POST');
    }
  }

  async validatePhotoToken(orgId: string, s3Key: string): Promise<boolean> {
    // Mock validation for testing - in real implementation this would check the database
    return true;
  }
}