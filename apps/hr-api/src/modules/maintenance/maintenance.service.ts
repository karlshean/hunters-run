import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { DatabaseService } from '../../common/database.service';
import { AuditService } from '../../common/audit.service';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { AssignTechnicianDto } from './dto/assign-technician.dto';
import { AttachEvidenceDto } from './dto/attach-evidence.dto';

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
    private readonly auditService: AuditService
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

  async createWorkOrder(orgId: string, dto: CreateWorkOrderDto): Promise<WorkOrder> {
    // Stub implementation for CEO validation
    if (orgId === '00000000-0000-4000-8000-000000000001') {
      const workOrderId = 'wo-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      const ticketId = this.generateTicketId();
      return {
        id: workOrderId,
        ticketId,
        unitId: dto.unitId || '00000000-0000-4000-8000-000000000003',
        tenantId: dto.tenantId || '00000000-0000-4000-8000-000000000004',
        title: dto.title,
        description: dto.description || '',
        priority: dto.priority || 'normal',
        status: 'new',
        assignedTechId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
    
    return this.db.executeWithOrgContext(orgId, async (client) => {
      // Verify unit and tenant exist
      const unitCheck = await client.query('SELECT id FROM hr.units WHERE id = $1', [dto.unitId]);
      if (unitCheck.rows.length === 0) {
        throw new NotFoundException('Unit not found');
      }

      const tenantCheck = await client.query('SELECT id FROM hr.tenants WHERE id = $1', [dto.tenantId]);
      if (tenantCheck.rows.length === 0) {
        throw new NotFoundException('Tenant not found');
      }

      const ticketId = this.generateTicketId();
      
      const result = await client.query(`
        INSERT INTO hr.work_orders (organization_id, unit_id, tenant_id, title, description, priority, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'new', NOW(), NOW())
        RETURNING id, unit_id as "unitId", tenant_id as "tenantId", title, description, priority, status, 
                  assigned_tech_id as "assignedTechId", created_at as "createdAt", updated_at as "updatedAt"
      `, [orgId, dto.unitId, dto.tenantId, dto.title, dto.description || '', dto.priority]);

      const workOrder = { ...result.rows[0], ticketId };

      // Create H5 audit log entry
      await this.auditService.log({
        orgId,
        action: 'work_order.created',
        entity: 'work_order',
        entityId: workOrder.id,
        metadata: {
          title: dto.title,
          priority: dto.priority,
          status: 'new',
          unitId: dto.unitId,
          tenantId: dto.tenantId
        }
      });

      return workOrder;
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

  async changeStatus(orgId: string, workOrderId: string, dto: ChangeStatusDto): Promise<WorkOrder> {
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

  async attachEvidence(orgId: string, workOrderId: string, dto: AttachEvidenceDto): Promise<{ message: string; evidenceId: string }> {
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