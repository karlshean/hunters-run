import { Module } from '@nestjs/common';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';
import { DatabaseService } from '../../common/database.service';
import { AuditService } from '../../common/audit.service';

@Module({
  controllers: [MaintenanceController],
  providers: [MaintenanceService, DatabaseService, AuditService],
})
export class MaintenanceModule {}