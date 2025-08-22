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
import { AttachPhotoEvidenceDto } from './dto/attach-photo-evidence.dto';
import { LookupsService } from '../lookups/lookups.service';

@Controller('maintenance')
@UseInterceptors(RLSInterceptor)
export class MaintenanceController {
  // In-memory storage for demo work orders
  private static demoWorkOrders: Map<string, any> = new Map();
  constructor(
    private readonly maintenanceService: MaintenanceService,
    private readonly lookupsService: LookupsService
  ) {}

  @Post('work-orders')
  @UsePipes(new ValidationPipe({ transform: true }))
  async createWorkOrder(@Req() req: any, @Body() dto: CreateWorkOrderDto) {
    if (!req.orgId) {
      throw new BadRequestException('Missing organization ID in request headers');
    }
    
    // Stub for demo org (CEO validation)
    if (req.orgId === '00000000-0000-4000-8000-000000000001') {
      const workOrderId = 'wo-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      const year = new Date().getFullYear();
      const sequence = Math.floor(Math.random() * 9999) + 1;
      const ticketId = `WO-${year}-${sequence.toString().padStart(4, '0')}`;
      const createdAt = new Date().toISOString();
      
      const unitName = dto.unitId === '00000000-0000-4000-8000-000000000003' ? 'Unit 101' : 'Unit 202';
      
      const workOrder = {
        id: workOrderId,
        ticketId,
        unitId: dto.unitId,
        unitName,
        description: dto.description,
        status: 'open',
        createdAt,
        photo_attached: !!(dto.photoMetadata || dto.tenantPhotoUrl),
        ...(dto.tenantPhotoUrl && { tenantPhotoUrl: dto.tenantPhotoUrl }),
        ...(dto.photoMetadata && { photoMetadata: dto.photoMetadata })
      };
      
      MaintenanceController.demoWorkOrders.set(workOrderId, workOrder);
      
      return {
        id: workOrderId,
        ticketId,
        unitId: dto.unitId,
        status: 'open',
        createdAt,
        photo_attached: !!(dto.photoMetadata || dto.tenantPhotoUrl),
        ...(dto.tenantPhotoUrl && { tenantPhotoUrl: dto.tenantPhotoUrl }),
        ...(dto.photoMetadata && { photoMetadata: dto.photoMetadata })
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

  @Get('work-orders')
  async listWorkOrders(@Req() req: any) {
    if (!req.orgId) {
      throw new BadRequestException('Missing organization ID in request headers');
    }
    
    // Stub for demo org
    if (req.orgId === '00000000-0000-4000-8000-000000000001') {
      const orders = Array.from(MaintenanceController.demoWorkOrders.values())
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 50);
      return orders;
    }
    
    return this.maintenanceService.listWorkOrders(req.orgId);
  }

  @Get('work-orders/:id')
  async getWorkOrder(@Req() req: any, @Param('id') id: string) {
    // Stub for demo org (CEO validation)
    if (req.orgId === '00000000-0000-4000-8000-000000000001') {
      const year = new Date().getFullYear();
      const sequence = Math.floor(Math.random() * 9999) + 1;
      const ticketId = `WO-${year}-${sequence.toString().padStart(4, '0')}`;
      
      return {
        id: id,
        ticketId,
        unitId: '00000000-0000-4000-8000-000000000003',
        tenantId: '00000000-0000-4000-8000-000000000004',
        title: 'CEO Test Work Order',
        description: 'Auto-generated for demo',
        priority: 'high',
        status: 'new',
        assignedTechId: '00000000-0000-4000-8000-000000000005',
        createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 mins ago
        updatedAt: new Date().toISOString()
      };
    }
    return this.maintenanceService.getWorkOrder(req.orgId, id);
  }

  @Patch('work-orders/:id/status')
  async changeStatus(@Req() req: any, @Param('id') id: string, @Body() dto: { status: string }) {
    if (!req.orgId) {
      throw new BadRequestException('Missing organization ID in request headers');
    }
    
    // For demo, only accept 'completed' status
    if (dto.status !== 'completed') {
      throw new BadRequestException('Only "completed" status is supported in this demo');
    }
    
    // Stub for demo org
    if (req.orgId === '00000000-0000-4000-8000-000000000001') {
      const workOrder = MaintenanceController.demoWorkOrders.get(id);
      if (workOrder) {
        workOrder.status = 'completed';
        MaintenanceController.demoWorkOrders.set(id, workOrder);
        return {
          id,
          ticketId: workOrder.ticketId,
          status: 'completed'
        };
      }
      throw new BadRequestException('Work order not found');
    }
    
    return this.maintenanceService.updateStatusToCompleted(req.orgId, id);
  }

  @Post('work-orders/:id/assign')
  async assignTechnician(@Req() req: any, @Param('id') id: string, @Body() dto: AssignTechnicianDto) {
    // Stub for demo org (CEO validation)
    if (req.orgId === '00000000-0000-4000-8000-000000000001') {
      const year = new Date().getFullYear();
      const sequence = Math.floor(Math.random() * 9999) + 1;
      const ticketId = `WO-${year}-${sequence.toString().padStart(4, '0')}`;
      
      return {
        id: id,
        ticketId,
        unitId: '00000000-0000-4000-8000-000000000003',
        tenantId: '00000000-0000-4000-8000-000000000004',
        title: 'CEO Test Work Order',
        description: 'Auto-generated for demo',
        priority: 'normal',
        status: 'assigned',
        assignedTechId: dto.technicianId,
        createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 mins ago
        updatedAt: new Date().toISOString()
      };
    }
    return this.maintenanceService.assignTechnician(req.orgId, id, dto);
  }

  @Post('work-orders/:id/evidence')
  @UsePipes(new ValidationPipe({ transform: true }))
  async attachPhotoEvidence(@Req() req: any, @Param('id') id: string, @Body() dto: AttachPhotoEvidenceDto) {
    if (!req.orgId) {
      throw new BadRequestException('Missing organization ID in request headers');
    }
    
    return this.maintenanceService.attachPhotoEvidence(req.orgId, id, dto);
  }

  @Post('work-orders/:id/legacy-evidence')
  async attachEvidence(@Req() req: any, @Param('id') id: string, @Body() dto: AttachEvidenceDto) {
    return this.maintenanceService.attachEvidence(req.orgId, id, dto);
  }

  @Get('work-orders/:id/audit/validate')
  async validateAudit(@Req() req: any, @Param('id') id: string) {
    return this.maintenanceService.validateAuditChain(req.orgId, id);
  }

  @Get('lookups/units')
  async getUnitsLookup(@Req() req: any) {
    if (!req.orgId) {
      throw new BadRequestException('Missing organization ID in request headers');
    }
    return this.lookupsService.listUnits(req.orgId);
  }
}