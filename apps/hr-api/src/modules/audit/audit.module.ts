import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from '../../common/audit.service';
import { DatabaseService } from '../../common/database.service';

@Module({
  controllers: [AuditController],
  providers: [AuditService, DatabaseService],
  exports: [AuditService]
})
export class AuditModule {}