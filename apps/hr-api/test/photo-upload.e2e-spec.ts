import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Photo Upload Workflow (e2e)', () => {
  let app: INestApplication;
  const demoOrgId = '00000000-0000-4000-8000-000000000001';
  
  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Photo Presign Endpoint', () => {
    it('should generate presigned URL for valid photo request', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/files/presign-photo')
        .set('x-org-id', demoOrgId)
        .send({
          fileName: 'test-photo.jpg',
          fileSize: 1024,
          mimeType: 'image/jpeg'
        })
        .expect(201);

      expect(response.body).toHaveProperty('presignedPost');
      expect(response.body).toHaveProperty('s3Key');
      expect(response.body).toHaveProperty('expires');
      
      expect(response.body.presignedPost).toHaveProperty('url');
      expect(response.body.presignedPost).toHaveProperty('fields');
      expect(response.body.s3Key).toContain('demo-org/work-orders/');
      expect(response.body.s3Key).toContain('test-photo.jpg');
    });

    it('should reject files over 5MB', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/files/presign-photo')
        .set('x-org-id', demoOrgId)
        .send({
          fileName: 'large-photo.jpg',
          fileSize: 6 * 1024 * 1024, // 6MB
          mimeType: 'image/jpeg'
        })
        .expect(400);

      expect(response.body.message).toContain('File size cannot exceed 5MB');
    });

    it('should reject unsupported mime types', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/files/presign-photo')
        .set('x-org-id', demoOrgId)
        .send({
          fileName: 'document.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf'
        })
        .expect(400);

      expect(response.body.message).toContain('Only JPEG, PNG, and WebP images are supported');
    });

    it('should require x-org-id header', async () => {
      await request(app.getHttpServer())
        .post('/api/files/presign-photo')
        .send({
          fileName: 'test.jpg',
          fileSize: 1024,
          mimeType: 'image/jpeg'
        })
        .expect(400);
    });
  });

  describe('Work Order with Photo Metadata', () => {
    let s3Key: string;

    beforeEach(async () => {
      // Get presigned URL first
      const presignResponse = await request(app.getHttpServer())
        .post('/api/files/presign-photo')
        .set('x-org-id', demoOrgId)
        .send({
          fileName: 'test-maintenance.jpg',
          fileSize: 2048,
          mimeType: 'image/jpeg'
        });
      
      s3Key = presignResponse.body.s3Key;
    });

    it('should create work order with photo metadata', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/maintenance/work-orders')
        .set('x-org-id', demoOrgId)
        .send({
          unitId: '00000000-0000-4000-8000-000000000003',
          tenantId: '00000000-0000-4000-8000-000000000004',
          title: 'Leak with photo',
          description: 'Kitchen sink is leaking',
          priority: 'high',
          photoMetadata: {
            s3Key: s3Key,
            sizeBytes: 2048,
            mimeType: 'image/jpeg'
          }
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('ticketId');
      expect(response.body.title).toBe('Leak with photo');
    });

    it('should reject work order with invalid photo token', async () => {
      await request(app.getHttpServer())
        .post('/api/maintenance/work-orders')
        .set('x-org-id', demoOrgId)
        .send({
          unitId: '00000000-0000-4000-8000-000000000003',
          tenantId: '00000000-0000-4000-8000-000000000004',
          title: 'Invalid photo test',
          priority: 'normal',
          photoMetadata: {
            s3Key: 'invalid/key/that/does/not/exist.jpg',
            sizeBytes: 1024,
            mimeType: 'image/jpeg'
          }
        })
        .expect(422); // Unprocessable Entity for invalid token
    });

    it('should create work order without photo (backward compatibility)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/maintenance/work-orders')
        .set('x-org-id', demoOrgId)
        .send({
          unitId: '00000000-0000-4000-8000-000000000003',
          tenantId: '00000000-0000-4000-8000-000000000004',
          title: 'No photo work order',
          description: 'This work order has no photo',
          priority: 'low'
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('No photo work order');
    });
  });

  describe('Complete Photo-First Flow', () => {
    it('should complete full photo upload and work order creation flow', async () => {
      // Step 1: Get presigned URL
      const presignResponse = await request(app.getHttpServer())
        .post('/api/files/presign-photo')
        .set('x-org-id', demoOrgId)
        .send({
          fileName: 'complete-flow-test.jpg',
          fileSize: 1536,
          mimeType: 'image/jpeg'
        })
        .expect(201);

      expect(presignResponse.body.s3Key).toBeDefined();
      const s3Key = presignResponse.body.s3Key;

      // Step 2: Mock S3 upload (in real test, would POST to presignResponse.body.presignedPost.url)
      // For demo org, we skip actual S3 upload as it's mocked

      // Step 3: Create work order with photo metadata
      const workOrderResponse = await request(app.getHttpServer())
        .post('/api/maintenance/work-orders')
        .set('x-org-id', demoOrgId)
        .send({
          unitId: '00000000-0000-4000-8000-000000000003',
          tenantId: '00000000-0000-4000-8000-000000000004',
          title: 'Complete flow test',
          description: 'Testing the complete photo-first flow',
          priority: 'normal',
          photoMetadata: {
            s3Key: s3Key,
            sizeBytes: 1536,
            mimeType: 'image/jpeg',
            uploadedAt: new Date().toISOString()
          }
        })
        .expect(201);

      expect(workOrderResponse.body).toHaveProperty('id');
      expect(workOrderResponse.body.title).toBe('Complete flow test');

      // Verify audit trail includes photo metadata
      const auditResponse = await request(app.getHttpServer())
        .get(`/api/audit/entity/work_order/${workOrderResponse.body.id}`)
        .set('x-org-id', demoOrgId)
        .expect(200);

      const createEvent = auditResponse.body.find((e: any) => e.action === 'work_order.created');
      expect(createEvent).toBeDefined();
      expect(createEvent.metadata).toHaveProperty('photoS3Key', s3Key);
    });
  });

  describe('S3 Mock for CI/CD', () => {
    it('should use demo S3 configuration for demo organization', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/files/presign-photo')
        .set('x-org-id', demoOrgId)
        .send({
          fileName: 'ci-test.jpg',
          fileSize: 512,
          mimeType: 'image/jpeg'
        })
        .expect(201);

      // Verify demo S3 configuration
      expect(response.body.presignedPost.url).toBe('https://demo-bucket.s3.amazonaws.com/');
      expect(response.body.presignedPost.fields.policy).toBe('demo-policy-base64');
      expect(response.body.presignedPost.fields['x-amz-signature']).toBe('demo-signature');
    });
  });
});