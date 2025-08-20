import { 
  Controller, 
  Get, 
  Param, 
  UseInterceptors, 
  Req 
} from '@nestjs/common';
import { AuditService } from '../../common/audit.service';
import { RLSInterceptor } from '../../common/rls.interceptor';

@Controller('audit')
@UseInterceptors(RLSInterceptor)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Verify the integrity of all audit chains for the organization
   */
  @Get('verify')
  async verifyChains(@Req() req: any) {
    return this.auditService.verifyChains(req.orgId);
  }

  /**
   * Get audit trail for a specific entity
   */
  @Get('entity/:entity/:entityId')
  async getEntityAuditTrail(
    @Req() req: any,
    @Param('entity') entity: string,
    @Param('entityId') entityId: string
  ) {
    return this.auditService.getEntityAuditTrail(req.orgId, entity, entityId);
  }

}