import { Module } from '@nestjs/common';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';
import { DatabaseService } from '../../common/database.service';

@Module({
  controllers: [MaintenanceController],
  providers: [MaintenanceService, DatabaseService],
})
export class MaintenanceModule {}