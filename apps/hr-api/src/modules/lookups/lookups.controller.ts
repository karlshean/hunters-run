import { 
  Controller, 
  Get, 
  UseInterceptors, 
  Req,
  BadRequestException
} from '@nestjs/common';
import { LookupsService } from './lookups.service';
import { RLSInterceptor } from '../../common/rls.interceptor';

@Controller('lookups')
@UseInterceptors(RLSInterceptor)
export class LookupsController {
  constructor(private readonly lookupsService: LookupsService) {}

  @Get('units')
  async getUnits(@Req() req: any) {
    if (!req.orgId) {
      throw new BadRequestException('Missing organization ID in request headers');
    }
    return this.lookupsService.listUnits(req.orgId);
  }

  @Get('tenants')
  async getTenants(@Req() req: any) {
    return this.lookupsService.getTenants(req.orgId);
  }

  @Get('technicians')
  async getTechnicians(@Req() req: any) {
    return this.lookupsService.getTechnicians(req.orgId);
  }

  @Get('properties')
  async getProperties(@Req() req: any) {
    return this.lookupsService.getProperties(req.orgId);
  }
}