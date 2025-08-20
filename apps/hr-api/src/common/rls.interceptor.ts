import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Client } from 'pg';

@Injectable()
export class RLSInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const orgId = request.headers['x-org-id'];

    if (!orgId) {
      throw new ForbiddenException('x-org-id header is required');
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(orgId)) {
      console.log(`RLS Interceptor: Invalid UUID format: ${orgId}, regex test result: ${uuidRegex.test(orgId)}`);
      throw new ForbiddenException('Invalid organization ID format');
    }

    // Store org ID in request for later use
    request.orgId = orgId;

    return next.handle();
  }
}