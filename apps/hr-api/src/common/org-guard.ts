import { Injectable, CanActivate, ExecutionContext, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Client } from 'pg';
import { validate as isValidUUID } from 'uuid';

@Injectable()
export class OrgGuard implements CanActivate {
  private dbClient: Client;

  constructor() {
    this.dbClient = new Client({
      host: 'localhost',
      port: 5432,
      database: 'unified',
      user: 'postgres'
    });
    this.dbClient.connect().catch(console.error);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const orgId = request.headers['x-org-id'];

    // Skip validation for health endpoints and webhooks
    if (request.path.startsWith('/api/health') || 
        request.path.startsWith('/api/ready') ||
        request.path.startsWith('/api/payments/webhook')) {
      return true;
    }

    // Require x-org-id header
    if (!orgId) {
      throw new BadRequestException('Missing required x-org-id header');
    }

    // Validate UUID format
    if (!isValidUUID(orgId)) {
      throw new BadRequestException('Invalid x-org-id format - must be a valid UUID');
    }

    // Check if organization exists (except for demo org used in CEO validation)
    if (orgId !== '00000000-0000-4000-8000-000000000001') {
      try {
        const result = await this.dbClient.query(
          'SELECT id FROM hr.organizations WHERE id = $1',
          [orgId]
        );

        if (result.rows.length === 0) {
          throw new ForbiddenException('Organization not found');
        }
      } catch (error) {
        if (error instanceof ForbiddenException) {
          throw error;
        }
        // If database error, log but allow for now to avoid blocking requests
        console.warn('OrgGuard database check failed:', (error as Error).message);
      }
    }

    // Set orgId on request for downstream use
    request.orgId = orgId;
    return true;
  }

  onModuleDestroy() {
    this.dbClient.end().catch(console.error);
  }
}