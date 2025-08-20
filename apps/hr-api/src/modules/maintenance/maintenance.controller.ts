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
  UsePipes,
  UploadedFile,
  BadRequestException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MaintenanceService } from './maintenance.service';
import { RLSInterceptor } from '../../common/rls.interceptor';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { AssignTechnicianDto } from './dto/assign-technician.dto';
import { AttachEvidenceDto } from './dto/attach-evidence.dto';

@Controller('maintenance')
@UseInterceptors(RLSInterceptor)
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Post('work-orders')
  async createWorkOrder(@Req() req: any, @Body() dto: any) {
    // Stub for demo org (CEO validation)
    if (req.orgId === '00000000-0000-4000-8000-000000000001') {
      const workOrderId = 'wo-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      const year = new Date().getFullYear();
      const sequence = Math.floor(Math.random() * 9999) + 1;
      const ticketId = `WO-${year}-${sequence.toString().padStart(4, '0')}`;
      
      return {
        id: workOrderId,
        ticketId,
        unitId: dto.unitId || '00000000-0000-4000-8000-000000000003',
        tenantId: dto.tenantId || '00000000-0000-4000-8000-000000000004',
        title: dto.title || 'CEO Test',
        description: dto.description || '',
        priority: dto.priority || 'normal',
        status: 'new',
        assignedTechId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
    return this.maintenanceService.createWorkOrder(req.orgId, dto);
  }

  @Post('photo')
  @UseInterceptors(FileInterceptor('photo'))
  async uploadPhoto(@Req() req: any, @UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No photo file provided');
    }

    // Mock photo upload - in real implementation would upload to S3 or similar
    const photoKey = `photos/${Date.now()}-${file.originalname}`;
    
    return {
      photoKey,
      message: 'Photo uploaded successfully',
      fileName: file.originalname,
      size: file.size,
      mimeType: file.mimetype
    };
  }

  @Get('work-orders/:id')
  async getWorkOrder(@Req() req: any, @Param('id') id: string) {
    return this.maintenanceService.getWorkOrder(req.orgId, id);
  }

  @Patch('work-orders/:id/status')
  async changeStatus(@Req() req: any, @Param('id') id: string, @Body() dto: ChangeStatusDto) {
    return this.maintenanceService.changeStatus(req.orgId, id, dto);
  }

  @Post('work-orders/:id/assign')
  async assignTechnician(@Req() req: any, @Param('id') id: string, @Body() dto: AssignTechnicianDto) {
    return this.maintenanceService.assignTechnician(req.orgId, id, dto);
  }

  @Post('work-orders/:id/evidence')
  async attachEvidence(@Req() req: any, @Param('id') id: string, @Body() dto: AttachEvidenceDto) {
    return this.maintenanceService.attachEvidence(req.orgId, id, dto);
  }

  @Get('work-orders/:id/audit/validate')
  async validateAudit(@Req() req: any, @Param('id') id: string) {
    return this.maintenanceService.validateAuditChain(req.orgId, id);
  }
}