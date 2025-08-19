import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { DatabaseService } from '../../common/database.service';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { AssignTechnicianDto } from './dto/assign-technician.dto';
import { AttachEvidenceDto } from './dto/attach-evidence.dto';

export interface WorkOrder {
  id: string;
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
  constructor(private readonly db: DatabaseService) {}

  private readonly validTransitions: Record<string, string[]> = {
    'new': ['triaged'],
    'triaged': ['assigned'],
    'assigned': ['in_progress'],
    'in_progress': ['completed'],
    'completed': ['closed'],
    'closed': ['reopened'],
    'reopened': ['assigned', 'in_progress']
  };

  async createWorkOrder(orgId: string, dto: CreateWorkOrderDto): Promise<WorkOrder> {
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

      const result = await client.query(`
        INSERT INTO hr.work_orders (organization_id, unit_id, tenant_id, title, description, priority, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'new', NOW(), NOW())
        RETURNING id, unit_id as "unitId", tenant_id as "tenantId", title, description, priority, status, 
                  assigned_tech_id as "assignedTechId", created_at as "createdAt", updated_at as "updatedAt"
      `, [orgId, dto.unitId, dto.tenantId, dto.title, dto.description || '', dto.priority]);

      const workOrder = result.rows[0];

      // Create audit event
      await client.query(`
        SELECT hr.create_audit_event($1, 'create', 'work_order', $2, $3)
      `, [
        orgId,
        workOrder.id,
        JSON.stringify({ title: dto.title, priority: dto.priority, status: 'new' })
      ]);

      return workOrder;
    });
  }

  async getWorkOrder(orgId: string, workOrderId: string): Promise<WorkOrder> {
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

      return result.rows[0];
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

      // Create audit event
      await client.query(`
        SELECT hr.create_audit_event($1, 'status_change', 'work_order', $2, $3)
      `, [
        orgId,
        workOrderId,
        JSON.stringify({ 
          fromStatus: currentStatus, 
          toStatus: dto.toStatus, 
          note: dto.note 
        })
      ]);

      return result.rows[0];
    });
  }

  async validateAuditChain(orgId: string, workOrderId: string): Promise<{ valid: boolean; eventsCount: number; headHash: string }> {
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