import { Module } from '@nestjs/common';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';
import { DatabaseService } from '../../common/database.service';
import { AuditService } from '../../common/audit.service';
import { FilesService } from '../files/files.service';

@Module({
  controllers: [MaintenanceController],
  providers: [MaintenanceService, DatabaseService, AuditService, FilesService],
})
export class MaintenanceModule {}