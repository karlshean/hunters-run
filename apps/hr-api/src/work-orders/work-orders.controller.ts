// === DEMO SLICE: Work Orders Controller ===
import { Controller, Get, Post, Patch, Param, Body, Query, Headers, UseGuards } from '@nestjs/common';
import { RequireOrg, CurrentUser } from '../auth/decorators';
import { PgService } from '../db/pg.service';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

@Controller('api/v1/work-orders')
@UseGuards(RequireOrg)
export class WorkOrdersController {
  constructor(private readonly pg: PgService) {}

  @Get()
  async list(@Query('status') status?: string): Promise<ApiResponse> {
    try {
      const query = status
        ? 'SELECT * FROM hr.work_orders WHERE org_id = $1 AND status = $2 ORDER BY created_at DESC'
        : 'SELECT * FROM hr.work_orders WHERE org_id = $1 ORDER BY created_at DESC';
      
      const params = status ? [this.pg.getOrgId(), status] : [this.pg.getOrgId()];
      const result = await this.pg.query(query, params);
      
      return { success: true, data: result.rows };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Get(':id')
  async detail(@Param('id') id: string): Promise<ApiResponse> {
    try {
      const result = await this.pg.query(
        'SELECT * FROM hr.work_orders WHERE id = $1 AND org_id = $2',
        [id, this.pg.getOrgId()]
      );
      
      if (result.rows.length === 0) {
        return { success: false, error: 'Work order not found' };
      }
      
      return { success: true, data: result.rows[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updates: { status?: string; assignee?: string; note?: string },
    @Headers('idempotency-key') idempotencyKey?: string
  ): Promise<ApiResponse> {
    try {
      // Check if work order exists and belongs to org
      const existing = await this.pg.query(
        'SELECT * FROM hr.work_orders WHERE id = $1 AND org_id = $2',
        [id, this.pg.getOrgId()]
      );
      
      if (existing.rows.length === 0) {
        return { success: false, error: 'Work order not found' };
      }

      // Build dynamic update query
      const updateFields = [];
      const values = [];
      let paramCount = 1;

      if (updates.status) {
        updateFields.push(`status = $${paramCount++}`);
        values.push(updates.status);
      }
      if (updates.assignee) {
        updateFields.push(`assignee = $${paramCount++}`);
        values.push(updates.assignee);
      }
      if (updates.note) {
        updateFields.push(`notes = $${paramCount++}`);
        values.push(updates.note);
      }

      updateFields.push(`updated_at = NOW()`);
      values.push(id, this.pg.getOrgId());

      const query = `
        UPDATE hr.work_orders 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount++} AND org_id = $${paramCount++}
        RETURNING *
      `;

      const result = await this.pg.query(query, values);
      return { success: true, data: result.rows[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Post()
  async create(@Body() workOrder: any): Promise<ApiResponse> {
    try {
      const result = await this.pg.query(
        `INSERT INTO hr.work_orders (org_id, title, description, property_id, status, created_at) 
         VALUES ($1, $2, $3, $4, 'SUBMITTED', NOW()) 
         RETURNING *`,
        [
          this.pg.getOrgId(),
          workOrder.title,
          workOrder.description,
          workOrder.property_id
        ]
      );
      
      return { success: true, data: result.rows[0] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}