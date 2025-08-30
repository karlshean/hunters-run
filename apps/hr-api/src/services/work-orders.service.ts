import { Injectable } from "@nestjs/common";
import { AppDataSource } from "@platform/db/src/datasource";
import { RLSMonitoringService } from './rls-monitoring.service';

@Injectable()
export class WorkOrdersService {
  constructor(private readonly rlsMonitoring: RLSMonitoringService) {}
  
  async getWorkOrders(orgId: string) {
    if (!orgId) {
      throw new Error('Organization ID is required');
    }

    // Set org context for RLS
    try {
      await AppDataSource.query('SELECT set_config($1, $2, true)', ['app.org_id', orgId]);
      this.rlsMonitoring.logRLSContextSet(orgId, true);
    } catch (error: any) {
      this.rlsMonitoring.logRLSContextSet(orgId, false, 'app.org_id', error.message);
      throw error;
    }
    
    // Query work orders - RLS will automatically filter by organization
    const [rows, countResult] = await Promise.all([
      AppDataSource.query('SELECT id, title, status, priority, created_at, organization_id FROM hr.work_orders ORDER BY created_at DESC'),
      AppDataSource.query('SELECT COUNT(*) as count FROM hr.work_orders')
    ]);

    const count = parseInt(countResult[0]?.count || '0');
    
    this.rlsMonitoring.logRLSQueryFiltered('work_orders', orgId, rows.length, 'SELECT');

    return {
      workOrders: rows,
      count,
      orgId
    };
  }

  async createWorkOrder(orgId: string, createData: any) {
    if (!orgId) {
      throw new Error('Organization ID is required');
    }

    // Set org context for RLS
    await AppDataSource.query('SELECT set_config($1, $2, true)', ['app.org_id', orgId]);

    // Generate ticket number (simple incrementing approach)
    const ticketCountResult = await AppDataSource.query(
      'SELECT COUNT(*) + 1 as next_number FROM hr.work_orders WHERE organization_id = $1',
      [orgId]
    );
    const ticketNumber = `WO-${String(ticketCountResult[0]?.next_number || 1).padStart(4, '0')}`;

    // Insert new work order - RLS will automatically set organization_id
    const insertResult = await AppDataSource.query(`
      INSERT INTO hr.work_orders (id, organization_id, title, status, priority, ticket_number, created_at) 
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW()) 
      RETURNING id, title, status, priority, ticket_number, created_at, organization_id
    `, [
      orgId,
      createData.title,
      createData.status || 'open',
      createData.priority || 'medium',
      ticketNumber
    ]);

    if (!insertResult || insertResult.length === 0) {
      throw new Error('Failed to create work order');
    }

    return {
      workOrder: insertResult[0],
      orgId
    };
  }

  async updateWorkOrder(orgId: string, workOrderId: string, updateData: any) {
    if (!orgId) {
      throw new Error('Organization ID is required');
    }

    // Set org context for RLS
    await AppDataSource.query('SELECT set_config($1, $2, true)', ['app.org_id', orgId]);

    // Build dynamic update query for safe fields only
    const safeFields = ['title', 'status', 'priority'];
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 2; // Start at 2 since $1 is workOrderId

    Object.keys(updateData).forEach(key => {
      if (safeFields.includes(key) && updateData[key] !== undefined) {
        updateFields.push(`${key} = $${paramIndex}`);
        updateValues.push(updateData[key]);
        paramIndex++;
      }
    });

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    // Update work order - RLS ensures only org-scoped records are affected
    const updateResult = await AppDataSource.query(`
      UPDATE hr.work_orders 
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = $1
      RETURNING id, title, status, priority, ticket_number, created_at, updated_at, organization_id
    `, [workOrderId, ...updateValues]);

    if (!updateResult || updateResult.length === 0) {
      throw new Error('Work order not found or access denied');
    }

    return {
      workOrder: updateResult[0],
      orgId
    };
  }

  async transitionWorkOrder(orgId: string, workOrderId: string, newStatus: string, reason?: string) {
    if (!orgId) {
      throw new Error('Organization ID is required');
    }

    // Set org context for RLS
    await AppDataSource.query('SELECT set_config($1, $2, true)', ['app.org_id', orgId]);

    // First, get the current work order to check current status
    const currentResult = await AppDataSource.query(
      'SELECT id, status, title, organization_id FROM hr.work_orders WHERE id = $1',
      [workOrderId]
    );

    if (!currentResult || currentResult.length === 0) {
      throw new Error('Work order not found or access denied');
    }

    const currentWorkOrder = currentResult[0];
    const previousStatus = currentWorkOrder.status;

    // Validate transition (basic rules)
    const validTransitions: Record<string, string[]> = {
      'open': ['in_progress', 'cancelled'],
      'in_progress': ['completed', 'open', 'cancelled'],
      'completed': [], // Completed orders cannot be transitioned
      'cancelled': ['open'] // Cancelled orders can be reopened
    };

    if (!validTransitions[previousStatus] || !validTransitions[previousStatus].includes(newStatus)) {
      throw new Error(`Invalid transition from ${previousStatus} to ${newStatus}`);
    }

    // Update the work order status
    const updateResult = await AppDataSource.query(`
      UPDATE hr.work_orders 
      SET status = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING id, title, status, priority, ticket_number, created_at, updated_at, organization_id
    `, [workOrderId, newStatus]);

    if (!updateResult || updateResult.length === 0) {
      throw new Error('Failed to update work order status');
    }

    // Record the transition (if transitions table exists)
    try {
      await AppDataSource.query(`
        INSERT INTO hr.work_order_transitions (id, work_order_id, organization_id, from_status, to_status, reason, created_at)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())
      `, [workOrderId, orgId, previousStatus, newStatus, reason || null]);
    } catch (error: any) {
      // Ignore if transitions table doesn't exist - it's optional
      console.warn('Could not record transition (transitions table may not exist):', error.message);
    }

    return {
      workOrder: updateResult[0],
      previousStatus,
      orgId
    };
  }
}