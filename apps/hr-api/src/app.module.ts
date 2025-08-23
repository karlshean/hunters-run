import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { HealthController, ReadyController } from './routes/health.controller';
import { FlagsController } from './routes/flags.controller';
import { LookupsModule } from './modules/lookups/lookups.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AuditModule } from './modules/audit/audit.module';
import { FilesModule } from './modules/files/files.module';
import { WorkOrdersModule } from './modules/work-orders/work-orders.module';
import { OrgGuard } from './common/org-guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuditModule,
    FilesModule,
    LookupsModule,
    MaintenanceModule,
    PaymentsModule,
    WorkOrdersModule,
  ],
  controllers: [HealthController, ReadyController, FlagsController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: OrgGuard,
    },
  ],
})
export class AppModule {}
