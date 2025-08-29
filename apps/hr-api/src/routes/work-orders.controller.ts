import { Controller, Get, Headers, BadRequestException } from "@nestjs/common";
import { WorkOrdersService } from "../services/work-orders.service";

@Controller()
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  @Get("api/work-orders")
  async getWorkOrders(@Headers('x-org-id') orgId?: string) {
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
    } catch (error) {
      console.error('Work orders query failed:', error);
      throw new BadRequestException('Failed to retrieve work orders');
    }
  }
}