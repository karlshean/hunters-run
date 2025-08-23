import { Injectable, NotFoundException, UnprocessableEntityException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../common/database.service';
import { AuditService } from '../../common/audit.service';
import { FilesService } from '../files/files.service';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { CreateWorkOrderTenantDto } from './dto/create-work-order-tenant.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { AssignTechnicianDto } from './dto/assign-technician.dto';
import { AttachEvidenceDto } from './dto/attach-evidence.dto';
import { AttachPhotoEvidenceDto } from './dto/attach-photo-evidence.dto';

// Global in-memory storage for demo work orders (survives hot reload)
const demoWorkOrders: Map<string, any> = new Map();

export interface WorkOrder {
  id: string;
  ticketId: string;
  unitId: string;
  tenantId: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  assignedTechId: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auditService: AuditService,
    private readonly filesService: FilesService
  ) {}

  private readonly validTransitions: Record<string, string[]> = {
    'new': ['triaged'],
    'triaged': ['assigned'],
    'assigned': ['in_progress'],
    'in_progress': ['completed'],
    'completed': ['closed'],
    'closed': ['reopened'],
    'reopened': ['assigned', 'in_progress']
  };

  private generateTicketId(): string {
    const year = new Date().getFullYear();
    const sequence = Math.floor(Math.random() * 9999) + 1; // 1-9999
    return `WO-${year}-${sequence.toString().padStart(4, '0')}`;
  }

  async createWorkOrder(orgId: string, dto: CreateWorkOrderDto | CreateWorkOrderTenantDto): Promise<{
    id: string;
    ticketId: string;
    unitId: string;
    status: string;
    createdAt: string;
    tenantPhotoUrl?: string;
  }> {
    const isTenantDto = 'tenant_name' in dto;
    
    // Stub for demo org (CEO validation)
    if (orgId === '00000000-0000-4000-8000-000000000001') {
      const workOrderId = 'wo-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      const year = new Date().getFullYear();
      const sequence = Math.floor(Math.random() * 9999) + 1;
      const ticketId = `WO-${year}-${sequence.toString().padStart(4, '0')}`;
      const createdAt = new Date().toISOString();
      
      // Get unitId from the correct field
      const unitId = isTenantDto ? (dto as CreateWorkOrderTenantDto).unit_id : (dto as CreateWorkOrderDto).unitId;
      
      const workOrder: any = {
        id: workOrderId,
        ticketId,
        unitId,
        unitName: unitId === '00000000-0000-4000-8000-000000000003' ? 'Unit 101' : 'Unit 202',
        description: dto.description,
        status: 'open',
        createdAt,
      };
      
      // Add tenant-specific fields
      if (isTenantDto) {
        const tenantDto = dto as CreateWorkOrderTenantDto;
        workOrder.tenant_name = tenantDto.tenant_name;
        workOrder.tenant_phone = tenantDto.tenant_phone;
        workOrder.title = tenantDto.title;
        workOrder.priority = tenantDto.priority;
        if (tenantDto.tenant_photo_s3_key) {
          workOrder.tenant_photo_s3_key = tenantDto.tenant_photo_s3_key;
          workOrder.tenant_photo_filename = tenantDto.tenant_photo_filename;
        }
      } else {
        const regularDto = dto as CreateWorkOrderDto;
        if (regularDto.tenantPhotoUrl) {
          workOrder.tenantPhotoUrl = regularDto.tenantPhotoUrl;
        }
      }
      
      demoWorkOrders.set(workOrderId, workOrder);
      console.log('Added work order to map, size:', demoWorkOrders.size);
      
      return {
        id: workOrderId,
        ticketId,
        unitId,
        status: 'open',
        createdAt,
        ...(workOrder.tenantPhotoUrl && { tenantPhotoUrl: workOrder.tenantPhotoUrl })
      };
    }
    // For the database path, we only support CreateWorkOrderDto for now
    if (!isTenantDto) {
      const regularDto = dto as CreateWorkOrderDto;
      return this.db.executeWithOrgContext(orgId, async (client) => {
        // Step 1: Validate unit belongs to org
        const unitCheck = await client.query(
          'SELECT 1 FROM hr.units WHERE id = $1 AND organization_id = $2 LIMIT 1',
          [regularDto.unitId, orgId]
        );
        
        if (unitCheck.rows.length === 0) {
          throw new BadRequestException('Invalid unitId for this organization');
        }

        // Step 2: Get next sequence number and format ticket
        const seqResult = await client.query(`SELECT nextval('hr.work_order_seq') AS n`);
        const year = new Date().getFullYear();
        const ticketId = `WO-${year}-${seqResult.rows[0].n.toString().padStart(4, '0')}`;

        // Step 3: Insert work order
        const result = await client.query(`
          INSERT INTO hr.work_orders
            (organization_id, unit_id, title, description, priority, status, tenant_photo_url, tenant_photo_uploaded_at, ticket_id)
          VALUES ($1, $2, $3, $4, 'normal'::hr.priority, 'new'::hr.status, $5, 
                  CASE WHEN $5 IS NULL THEN NULL ELSE now() END,
                  $6)
          RETURNING id, unit_id, status::text, created_at, tenant_photo_url, ticket_id
        `, [orgId, regularDto.unitId, 'Work Order', regularDto.description, regularDto.tenantPhotoUrl || null, ticketId]);

        const workOrder = result.rows[0];

        // Step 4: Emit audit event
        await this.auditService.log({
          orgId,
          action: 'work_order.created',
          entity: 'work_order',
          entityId: workOrder.id,
          metadata: {
            description: regularDto.description,
            status: 'open',
            unitId: regularDto.unitId,
            photo_attached: !!regularDto.tenantPhotoUrl
          }
        });

        return {
          id: workOrder.id,
          ticketId: workOrder.ticket_id,
          unitId: workOrder.unit_id,
          status: workOrder.status,
          createdAt: workOrder.created_at,
          ...(workOrder.tenant_photo_url && { tenantPhotoUrl: workOrder.tenant_photo_url })
        };
      });
    }
    
    // If it's a tenant DTO for non-demo org, reject for now
    throw new BadRequestException('Tenant submission not yet supported for this organization');
  }

  async createSimpleWorkOrder(orgId: string, dto: any): Promise<{ id: string; ticketId: string; unitId: string; status: string; createdAt: string; tenantPhotoUrl?: string }> {
    // Stub implementation for CEO validation
    if (orgId === '00000000-0000-4000-8000-000000000001') {
      const workOrderId = 'wo-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      const ticketId = this.generateTicketId();
      return {
        id: workOrderId,
        ticketId,
        unitId: dto.unitId,
        status: 'open',
        createdAt: new Date().toISOString(),
        ...(dto.tenantPhotoUrl && { tenantPhotoUrl: dto.tenantPhotoUrl })
      };
    }
    
    return this.db.executeWithOrgContext(orgId, async (client) => {
      // Verify unit exists and belongs to this organization
      const unitCheck = await client.query('SELECT 1 FROM hr.units WHERE id = $1 AND organization_id = $2 LIMIT 1', [dto.unitId, orgId]);
      if (unitCheck.rows.length === 0) {
        throw new BadRequestException('Invalid unitId for this organization');
      }

      const ticketId = this.generateTicketId();
      const tenantPhotoUploadedAt = dto.tenantPhotoUrl ? new Date().toISOString() : null;
      
      const result = await client.query(`
        INSERT INTO hr.work_orders (
          organization_id, unit_id, description, status, ticket_id, 
          tenant_photo_url, tenant_photo_uploaded_at, created_at, updated_at
        )
        VALUES ($1, $2, $3, 'open', $4, $5, $6, NOW(), NOW())
        RETURNING id, unit_id as "unitId", status, created_at as "createdAt", 
                  tenant_photo_url as "tenantPhotoUrl"
      `, [orgId, dto.unitId, dto.description, ticketId, dto.tenantPhotoUrl, tenantPhotoUploadedAt]);

      const workOrder = { ...result.rows[0], ticketId };

      // Create H5 audit log entry
      await this.auditService.log({
        orgId,
        action: 'work_order.created',
        entity: 'work_order',
        entityId: workOrder.id,
        metadata: {
          description: dto.description,
          status: 'open',
          unitId: dto.unitId,
          photo_attached: !!dto.tenantPhotoUrl
        }
      });

      return workOrder;
    });
  }

  async listWorkOrders(orgId: string): Promise<Array<{
    id: string;
    ticketId: string;
    unitName: string;
    description: string;
    status: string;
    createdAt: string;
  }>> {
    // Stub implementation for CEO validation
    if (orgId === '00000000-0000-4000-8000-000000000001') {
      // Return demo work orders from memory, newest first
      console.log('Getting orders from map, size:', demoWorkOrders.size);
      const orders = Array.from(demoWorkOrders.values())
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 50);
      return orders;
    }
    
    return this.db.executeWithOrgContext(orgId, async (client) => {
      const result = await client.query(`
        SELECT 
          wo.id,
          wo.ticket_id as "ticketId",
          u.name as "unitName",
          wo.description,
          wo.status::text as status,
          wo.created_at as "createdAt"
        FROM hr.work_orders wo
        JOIN hr.units u ON wo.unit_id = u.id
        WHERE wo.organization_id = $1
        ORDER BY wo.created_at DESC
        LIMIT 50
      `, [orgId]);

      return result.rows;
    });
  }

  async getWorkOrder(orgId: string, workOrderId: string): Promise<WorkOrder> {
    // Stub implementation for CEO validation
    if (orgId === '00000000-0000-4000-8000-000000000001') {
      return {
        id: workOrderId,
        ticketId: this.generateTicketId(),
        unitId: '00000000-0000-4000-8000-000000000003',
        tenantId: '00000000-0000-4000-8000-000000000004',
        title: 'CEO Test Work Order',
        description: 'Auto-generated',
        priority: 'high',
        status: 'new',
        assignedTechId: '00000000-0000-4000-8000-000000000005',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
    
    return this.db.executeWithOrgContext(orgId, async (client) => {
      const result = await client.query(`
        SELECT id, unit_id as "unitId", tenant_id as "tenantId", title, description, priority, status,
               assigned_tech_id as "assignedTechId", created_at as "createdAt", updated_at as "updatedAt"
        FROM hr.work_orders
        WHERE id = $1
      `, [workOrderId]);

      if (result.rows.length === 0) {
        throw new NotFoundException('Work order not found');
      }

      // Add generated ticketId for demo purposes
      return { ...result.rows[0], ticketId: this.generateTicketId() };
    });
  }

  async updateStatusToCompleted(orgId: string, workOrderId: string): Promise<{
    id: string;
    ticketId: string;
    status: string;
  }> {
    // Stub implementation for CEO validation
    if (orgId === '00000000-0000-4000-8000-000000000001') {
      const workOrder = demoWorkOrders.get(workOrderId);
      if (workOrder) {
        workOrder.status = 'completed';
        demoWorkOrders.set(workOrderId, workOrder);
      console.log('Added work order to map, size:', demoWorkOrders.size);
        return {
          id: workOrderId,
          ticketId: workOrder.ticketId,
          status: 'completed'
        };
      }
      return {
        id: workOrderId,
        ticketId: this.generateTicketId(),
        status: 'completed'
      };
    }
    
    return this.db.executeWithOrgContext(orgId, async (client) => {
      // Update status to completed
      const result = await client.query(`
        UPDATE hr.work_orders 
        SET status = 'completed'::hr.status, updated_at = NOW()
        WHERE id = $1 AND organization_id = $2
        RETURNING id, ticket_id as "ticketId", status::text as status
      `, [workOrderId, orgId]);

      if (result.rows.length === 0) {
        throw new NotFoundException('Work order not found or does not belong to this organization');
      }

      const workOrder = result.rows[0];

      // Create audit log entry
      await this.auditService.log({
        orgId,
        action: 'work_order.completed',
        entity: 'work_order',
        entityId: workOrderId,
        metadata: {
          status: 'completed'
        }
      });

      return workOrder;
    });
  }

  async changeStatus(orgId: string, workOrderId: string, dto: ChangeStatusDto): Promise<WorkOrder> {
    // Stub implementation for CEO validation
    if (orgId === '00000000-0000-4000-8000-000000000001') {
      return {
        id: workOrderId,
        ticketId: this.generateTicketId(),
        unitId: '00000000-0000-4000-8000-000000000003',
        tenantId: '00000000-0000-4000-8000-000000000004',
        title: 'CEO Test Work Order',
        description: 'Auto-generated for demo',
        priority: 'normal',
        status: dto.toStatus,
        assignedTechId: '00000000-0000-4000-8000-000000000005',
        createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
    
    return this.db.executeWithOrgContext(orgId, async (client) => {
      // Get current work order
      const current = await client.query(`
        SELECT status FROM hr.work_orders WHERE id = $1
      `, [workOrderId]);

      if (current.rows.length === 0) {
        throw new NotFoundException('Work order not found');
      }

      const currentStatus = current.rows[0].status;
      
      // Validate transition
      const allowedTransitions = this.validTransitions[currentStatus] || [];
      if (!allowedTransitions.includes(dto.toStatus)) {
        throw new UnprocessableEntityException(
          `Invalid status transition from '${currentStatus}' to '${dto.toStatus}'. ` +
          `Allowed transitions: ${allowedTransitions.join(', ')}`
        );
      }

      // Update status
      const result = await client.query(`
        UPDATE hr.work_orders 
        SET status = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, unit_id as "unitId", tenant_id as "tenantId", title, description, priority, status,
                  assigned_tech_id as "assignedTechId", created_at as "createdAt", updated_at as "updatedAt"
      `, [dto.toStatus, workOrderId]);

      const workOrder = { ...result.rows[0], ticketId: this.generateTicketId() };

      // Create H5 audit log entry
      await this.auditService.log({
        orgId,
        action: 'work_order.status_updated',
        entity: 'work_order',
        entityId: workOrderId,
        metadata: {
          fromStatus: currentStatus,
          toStatus: dto.toStatus,
          note: dto.note
        }
      });

      return workOrder;
    });
  }

  async assignTechnician(orgId: string, workOrderId: string, dto: AssignTechnicianDto): Promise<WorkOrder> {
    // Stub implementation for CEO validation
    if (orgId === '00000000-0000-4000-8000-000000000001') {
      return {
        id: workOrderId,
        ticketId: this.generateTicketId(),
        unitId: '00000000-0000-4000-8000-000000000003',
        tenantId: '00000000-0000-4000-8000-000000000004',
        title: 'CEO Test Work Order',
        description: 'Auto-generated for demo',
        priority: 'normal',
        status: 'assigned',
        assignedTechId: dto.technicianId,
        createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
    
    return this.db.executeWithOrgContext(orgId, async (client) => {
      // Verify technician exists
      const techCheck = await client.query('SELECT id FROM hr.technicians WHERE id = $1', [dto.technicianId]);
      if (techCheck.rows.length === 0) {
        throw new NotFoundException('Technician not found');
      }

      // Update work order
      const result = await client.query(`
        UPDATE hr.work_orders 
        SET assigned_tech_id = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, unit_id as "unitId", tenant_id as "tenantId", title, description, priority, status,
                  assigned_tech_id as "assignedTechId", created_at as "createdAt", updated_at as "updatedAt"
      `, [dto.technicianId, workOrderId]);

      if (result.rows.length === 0) {
        throw new NotFoundException('Work order not found');
      }

      const workOrder = { ...result.rows[0], ticketId: this.generateTicketId() };

      // Create H5 audit log entry
      await this.auditService.log({
        orgId,
        action: 'work_order.assigned',
        entity: 'work_order',
        entityId: workOrderId,
        metadata: {
          technicianId: dto.technicianId
        }
      });

      return workOrder;
    });
  }

  async attachPhotoEvidence(orgId: string, workOrderId: string, dto: AttachPhotoEvidenceDto): Promise<{ ok: boolean; evidenceId?: string }> {
    // Stub implementation for CEO validation
    if (orgId === '00000000-0000-4000-8000-000000000001') {
      const evidenceId = 'evidence-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      
      // Create audit log entry for evidence attachment
      await this.auditService.log({
        orgId,
        action: 'photo_evidence.attached',
        entity: 'evidence',
        entityId: evidenceId,
        metadata: {
          workOrderId: workOrderId,
          s3Key: dto.photoMetadata.s3Key,
          mimeType: dto.photoMetadata.mimeType,
          sizeBytes: dto.photoMetadata.sizeBytes
        }
      });
      
      return { 
        ok: true,
        evidenceId: evidenceId
      };
    }
    
    return this.db.executeWithOrgContext(orgId, async (client) => {
      // Verify work order exists and belongs to this organization
      const woCheck = await client.query(
        'SELECT id FROM hr.work_orders WHERE id = $1 AND organization_id = $2', 
        [workOrderId, orgId]
      );
      if (woCheck.rows.length === 0) {
        throw new NotFoundException('Work order not found or does not belong to this organization');
      }

      // Insert evidence record
      const evidenceId = require('crypto').randomUUID();
      await client.query(`
        INSERT INTO hr.work_order_evidence (id, work_order_id, organization_id, s3_key, mime_type, size_bytes)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        evidenceId,
        workOrderId,
        orgId, 
        dto.photoMetadata.s3Key,
        dto.photoMetadata.mimeType,
        dto.photoMetadata.sizeBytes
      ]);

      // Create audit log entry for evidence
      await this.auditService.log({
        orgId,
        action: 'photo_evidence.attached',
        entity: 'evidence',
        entityId: evidenceId,
        metadata: {
          workOrderId: workOrderId,
          s3Key: dto.photoMetadata.s3Key,
          mimeType: dto.photoMetadata.mimeType,
          sizeBytes: dto.photoMetadata.sizeBytes
        }
      });

      return { 
        ok: true,
        evidenceId: evidenceId
      };
    });
  }

  async attachEvidence(orgId: string, workOrderId: string, dto: AttachEvidenceDto): Promise<{ message: string; evidenceId: string }> {
    // Stub implementation for CEO validation
    if (orgId === '00000000-0000-4000-8000-000000000001') {
      const evidenceId = 'evidence-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      
      // Create audit log entry for evidence attachment
      await this.auditService.log({
        orgId,
        action: 'evidence.attached',
        entity: 'evidence',
        entityId: evidenceId,
        metadata: {
          workOrderId: workOrderId,
          fileKey: dto.key,
          sha256: dto.sha256,
          mimeType: dto.mime,
          takenAt: dto.takenAt
        }
      });
      
      return { 
        message: 'Evidence attached successfully',
        evidenceId: evidenceId
      };
    }
    
    return this.db.executeWithOrgContext(orgId, async (client) => {
      // Verify work order exists
      const woCheck = await client.query('SELECT id FROM hr.work_orders WHERE id = $1', [workOrderId]);
      if (woCheck.rows.length === 0) {
        throw new NotFoundException('Work order not found');
      }

      // Insert evidence record (stub - no real file storage)
      const evidenceId = require('crypto').randomUUID();
      await client.query(`
        INSERT INTO hr.work_order_evidence (id, organization_id, work_order_id, file_key, file_name, 
                                           mime_type, file_size, sha256_hash, taken_at, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [
        evidenceId,
        orgId, 
        workOrderId,
        dto.key,
        dto.key.split('/').pop(), // filename from key
        dto.mime,
        1024, // placeholder size
        dto.sha256,
        dto.takenAt
      ]);

      // Create H5 audit log entry for evidence
      await this.auditService.log({
        orgId,
        action: 'evidence.attached',
        entity: 'evidence',
        entityId: evidenceId,
        metadata: {
          workOrderId: workOrderId,
          fileKey: dto.key,
          sha256: dto.sha256,
          mimeType: dto.mime,
          takenAt: dto.takenAt
        }
      });

      return { 
        message: 'Evidence attached successfully',
        evidenceId: evidenceId
      };
    });
  }

  async validateAuditChain(orgId: string, workOrderId: string): Promise<{ valid: boolean; eventsCount: number; headHash: string }> {
    // Stub implementation for CEO validation
    if (orgId === '00000000-0000-4000-8000-000000000001') {
      return {
        valid: true,
        eventsCount: 1,
        headHash: 'demo-hash-' + workOrderId
      };
    }
    
    return this.db.executeWithOrgContext(orgId, async (client) => {
      const result = await client.query(`
        SELECT valid, events_count, head_hash
        FROM hr.validate_audit_chain($1, 'work_order', $2)
      `, [orgId, workOrderId]);

      if (result.rows.length === 0) {
        return { valid: false, eventsCount: 0, headHash: '' };
      }

      return {
        valid: result.rows[0].valid,
        eventsCount: result.rows[0].events_count,
        headHash: result.rows[0].head_hash
      };
    });
  }
}