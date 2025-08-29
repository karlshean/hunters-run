import { Injectable } from "@nestjs/common";
import { AppDataSource } from "@platform/db/src/datasource";

@Injectable()
export class WorkOrdersService {
  
  async getWorkOrders(orgId: string) {
    if (!orgId) {
      throw new Error('Organization ID is required');
    }

    // Set org context for RLS
    await AppDataSource.query('SELECT set_config($1, $2, true)', ['app.org_id', orgId]);
    
    // Query work orders - RLS will automatically filter by organization
    const [rows, countResult] = await Promise.all([
      AppDataSource.query('SELECT id, title, status, priority, created_at, organization_id FROM hr.work_orders ORDER BY created_at DESC'),
      AppDataSource.query('SELECT COUNT(*) as count FROM hr.work_orders')
    ]);

    const count = parseInt(countResult[0]?.count || '0');

    return {
      workOrders: rows,
      count,
      orgId
    };
  }
}