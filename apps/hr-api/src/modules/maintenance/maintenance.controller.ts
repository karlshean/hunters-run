import { 
  Controller, 
  Get, 
  Post, 
  Patch, 
  Body, 
  Param, 
  UseInterceptors, 
  Req,
  ValidationPipe,
  UsePipes
} from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { RLSInterceptor } from '../../common/rls.interceptor';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { AssignTechnicianDto } from './dto/assign-technician.dto';
import { AttachEvidenceDto } from './dto/attach-evidence.dto';

@Controller('maintenance')
@UseInterceptors(RLSInterceptor)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Post('work-orders')
  async createWorkOrder(@Req() req: any, @Body() dto: CreateWorkOrderDto) {
    return this.maintenanceService.createWorkOrder(req.orgId, dto);
  }

  @Get('work-orders/:id')
  async getWorkOrder(@Req() req: any, @Param('id') id: string) {
    return this.maintenanceService.getWorkOrder(req.orgId, id);
  }

  @Patch('work-orders/:id/status')
  async changeStatus(@Req() req: any, @Param('id') id: string, @Body() dto: ChangeStatusDto) {
    return this.maintenanceService.changeStatus(req.orgId, id, dto);
  }

  @Get('work-orders/:id/audit/validate')
  async validateAudit(@Req() req: any, @Param('id') id: string) {
    return this.maintenanceService.validateAuditChain(req.orgId, id);
  }
}