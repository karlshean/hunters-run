import { 
  Controller, 
  Get, 
  Post, 
  Patch, 
  Body, 
  Param, 
  Query, 
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
import { CreateWorkOrderTenantDto } from './dto/create-work-order-tenant.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { AssignTechnicianDto } from './dto/assign-technician.dto';
import { AttachEvidenceDto } from './dto/attach-evidence.dto';
import { AttachPhotoEvidenceDto } from './dto/attach-photo-evidence.dto';
import { ListWorkOrdersDto } from '../work-orders/dto/list-work-orders.dto';
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
  async createWorkOrder(@Req() req: any, @Body() dto: CreateWorkOrderDto | CreateWorkOrderTenantDto) {
    if (!req.orgId) {
      throw new BadRequestException('Missing organization ID in request headers');
    }
    
    // Check if it's a tenant DTO (has tenant_name field)
    const isTenantDto = 'tenant_name' in dto;
    
    // Stub for demo org (CEO validation)
    if (req.orgId === '00000000-0000-4000-8000-000000000001') {
      const workOrderId = 'wo-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      const year = new Date().getFullYear();
      const sequence = Math.floor(Math.random() * 9999) + 1;
      const ticketId = `HR-${year}-${sequence.toString().padStart(3, '0')}`;
      const createdAt = new Date().toISOString();
      
      // Handle both DTO types
      const unitId = isTenantDto ? (dto as CreateWorkOrderTenantDto).unit_id : (dto as CreateWorkOrderDto).unitId;
      const unitName = unitId === '00000000-0000-4000-8000-000000000003' ? 'Unit 101' : 'Unit 202';
      
      const workOrder: any = {
        id: workOrderId,
        ticketId,
        unitId,
        unitName,
        description: dto.description,
        status: 'submitted',
        createdAt,
      };
      
      if (isTenantDto) {
        const tenantDto = dto as CreateWorkOrderTenantDto;
        workOrder.title = tenantDto.title;
        workOrder.priority = tenantDto.priority;
        workOrder.tenant_name = tenantDto.tenant_name;
        workOrder.tenant_phone = tenantDto.tenant_phone;
        workOrder.photo_attached = !!tenantDto.tenant_photo_s3_key;
        if (tenantDto.tenant_photo_s3_key) {
          workOrder.tenant_photo_s3_key = tenantDto.tenant_photo_s3_key;
          workOrder.tenant_photo_filename = tenantDto.tenant_photo_filename;
        }
      } else {
        const regularDto = dto as CreateWorkOrderDto;
        workOrder.photo_attached = !!(regularDto.photoMetadata || regularDto.tenantPhotoUrl);
        if (regularDto.tenantPhotoUrl) workOrder.tenantPhotoUrl = regularDto.tenantPhotoUrl;
        if (regularDto.photoMetadata) workOrder.photoMetadata = regularDto.photoMetadata;
      }
      
      MaintenanceController.demoWorkOrders.set(workOrderId, workOrder);
      
      return {
        id: workOrderId,
        ticketId,
        ticket_number: ticketId,
        unitId,
        status: 'submitted',
        createdAt,
        estimated_response_time: '24h',
        ...workOrder
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
  @UsePipes(new ValidationPipe({ transform: true }))
  async listWorkOrders(@Req() req: any, @Query() query: ListWorkOrdersDto) {
    if (!req.orgId) {
      throw new BadRequestException('Missing organization ID in request headers');
    }
    
    const limit = query.limit || 50;
    const status = query.status;
    
    // Stub for demo org
    if (req.orgId === '00000000-0000-4000-8000-000000000001') {
      let orders = Array.from(MaintenanceController.demoWorkOrders.values())
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // Apply status filter if provided
      if (status) {
        orders = orders.filter(order => order.status === status);
      }
      
      // Apply limit
      orders = orders.slice(0, limit);
      
      // Format response with required fields
      return orders.map(order => ({
        id: order.id,
        ticketId: order.ticketId,
        unitId: order.unitId,
        status: order.status,
        description: order.description,
        createdAt: order.createdAt,
        photo_attached: order.photo_attached || false
      }));
    }
    
    return this.maintenanceService.listWorkOrders(req.orgId, { limit, status });
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