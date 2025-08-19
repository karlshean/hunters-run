import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './routes/health.controller';
import { LookupsModule } from './modules/lookups/lookups.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { PaymentsModule } from './modules/payments/payments.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LookupsModule,
    MaintenanceModule,
    PaymentsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
