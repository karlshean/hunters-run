import { Controller, Get, Post, Patch, Headers, Body, Param, BadRequestException, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiParam } from "@nestjs/swagger";
import { WorkOrdersService } from "../services/work-orders.service";
import { PaginationDto, StandardResponseDto, ErrorResponseDto } from "../dto/common.dto";

@ApiTags('Work Orders')
@Controller('api/v1')
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  @Get("work-orders")
  @ApiOperation({ summary: 'List work orders for organization' })
  @ApiHeader({ name: 'x-org-id', description: 'Organization UUID', required: true })
  @ApiResponse({ status: 200, description: 'Work orders retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request', type: ErrorResponseDto })
  async getWorkOrders(
    @Headers('x-org-id') orgId?: string,
    @Query() pagination?: PaginationDto
  ) {
    if (!orgId) {
      throw new BadRequestException('Missing required header: x-org-id');
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(orgId)) {
      throw new BadRequestException('Invalid organization ID format');
    }

    try {
      const result = await this.workOrdersService.getWorkOrders(orgId);
      return {
        success: true,
        items: result.workOrders,
        count: result.count,
        meta: {
          organizationId: result.orgId
        }
      };
    } catch (error: any) {
      console.error('Work orders query failed:', error);
      throw new BadRequestException('Failed to retrieve work orders');
    }
  }

  @Post("api/work-orders")
  async createWorkOrder(
    @Headers('x-org-id') orgId?: string,
    @Body() createData?: any
  ) {
    if (!orgId) {
      throw new BadRequestException('Missing required header: x-org-id');
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(orgId)) {
      throw new BadRequestException('Invalid organization ID format');
    }

    // Basic validation
    if (!createData || !createData.title) {
      throw new BadRequestException('Missing required field: title');
    }

    try {
      const result = await this.workOrdersService.createWorkOrder(orgId, createData);
      return {
        success: true,
        workOrder: result.workOrder,
        meta: {
          organizationId: result.orgId
        }
      };
    } catch (error: any) {
      console.error('Work order creation failed:', error);
      throw new BadRequestException('Failed to create work order');
    }
  }

  @Patch("api/work-orders/:id")
  async updateWorkOrder(
    @Param('id') id: string,
    @Headers('x-org-id') orgId?: string,
    @Body() updateData?: any
  ) {
    if (!orgId) {
      throw new BadRequestException('Missing required header: x-org-id');
    }

    // Validate UUID formats
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(orgId)) {
      throw new BadRequestException('Invalid organization ID format');
    }
    if (!uuidRegex.test(id)) {
      throw new BadRequestException('Invalid work order ID format');
    }

    if (!updateData) {
      throw new BadRequestException('Missing update data');
    }

    try {
      const result = await this.workOrdersService.updateWorkOrder(orgId, id, updateData);
      if (!result.workOrder) {
        throw new BadRequestException('Work order not found or access denied');
      }
      
      return {
        success: true,
        workOrder: result.workOrder,
        meta: {
          organizationId: result.orgId
        }
      };
    } catch (error: any) {
      console.error('Work order update failed:', error);
      if (error.message.includes('not found')) {
        throw new BadRequestException('Work order not found or access denied');
      }
      throw new BadRequestException('Failed to update work order');
    }
  }

  @Post("api/work-orders/:id/transition")
  async transitionWorkOrder(
    @Param('id') id: string,
    @Headers('x-org-id') orgId?: string,
    @Body() transitionData?: any
  ) {
    if (!orgId) {
      throw new BadRequestException('Missing required header: x-org-id');
    }

    // Validate UUID formats
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(orgId)) {
      throw new BadRequestException('Invalid organization ID format');
    }
    if (!uuidRegex.test(id)) {
      throw new BadRequestException('Invalid work order ID format');
    }

    if (!transitionData || !transitionData.newStatus) {
      throw new BadRequestException('Missing required field: newStatus');
    }

    // Validate status values
    const validStatuses = ['open', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(transitionData.newStatus)) {
      throw new BadRequestException('Invalid status. Must be one of: ' + validStatuses.join(', '));
    }

    try {
      const result = await this.workOrdersService.transitionWorkOrder(orgId, id, transitionData.newStatus, transitionData.reason);
      if (!result.workOrder) {
        throw new BadRequestException('Work order not found or access denied');
      }
      
      return {
        success: true,
        workOrder: result.workOrder,
        transition: {
          from: result.previousStatus,
          to: transitionData.newStatus,
          reason: transitionData.reason || null
        },
        meta: {
          organizationId: result.orgId
        }
      };
    } catch (error: any) {
      console.error('Work order transition failed:', error);
      if (error.message.includes('not found')) {
        throw new BadRequestException('Work order not found or access denied');
      }
      if (error.message.includes('invalid transition')) {
        throw new BadRequestException('Invalid status transition');
      }
      throw new BadRequestException('Failed to transition work order');
    }
  }
}