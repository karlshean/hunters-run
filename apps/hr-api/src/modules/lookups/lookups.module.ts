import { Module } from '@nestjs/common';
import { LookupsController } from './lookups.controller';
import { LookupsService } from './lookups.service';
import { DatabaseService } from '../../common/database.service';

@Module({
  controllers: [LookupsController],
  providers: [LookupsService, DatabaseService],
})
export class LookupsModule {}