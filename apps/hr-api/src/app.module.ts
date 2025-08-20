import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { HealthController, ReadyController } from './routes/health.controller';
import { LookupsModule } from './modules/lookups/lookups.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AuditModule } from './modules/audit/audit.module';
import { OrgGuard } from './common/org-guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuditModule,
    LookupsModule,
    MaintenanceModule,
    PaymentsModule,
  ],
  controllers: [HealthController, ReadyController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: OrgGuard,
    },
  ],
})
export class AppModule {}
