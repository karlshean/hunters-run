# apps/api/src/legal/legal.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LegalTemplate } from '../database/entities/legal-template.entity';
import { LegalNotice } from '../database/entities/legal-notice.entity';
import { ServiceAttempt } from '../database/entities/service-attempt.entity';
import { TemplatesController } from './templates/templates.controller';
import { TemplatesService } from './templates/templates.service';
import { NoticesController } from './notices/notices.controller';
import { NoticesService } from './notices/notices.service';
import { ServiceAttemptsController } from './service-attempts/service-attempts.controller';
import { ServiceAttemptsService } from './service-attempts/service-attempts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([LegalTemplate, LegalNotice, ServiceAttempt]),
  ],
  controllers: [TemplatesController, NoticesController, ServiceAttemptsController],
  providers: [TemplatesService, NoticesService, ServiceAttemptsService],
  exports: [TemplatesService, NoticesService, ServiceAttemptsService],
})
export class LegalModule {}

# apps/api/src/legal/templates/dto/create-template.dto.ts
import { IsString, IsEnum, IsOptional, IsBoolean, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTemplateDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: ['pay_or_quit', 'cure_or_quit', 'unconditional_quit', 'lease_violation', 'non_renewal', 'rent_increase', 'entry_notice', 'other'] })
  @IsEnum(['pay_or_quit', 'cure_or_quit', 'unconditional_quit', 'lease_violation', 'non_renewal', 'rent_increase', 'entry_notice', 'other'])
  notice_type: string;

  @ApiProperty()
  @IsString()
  body: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateTemplateDto extends CreateTemplateDto {}

# apps/api/src/legal/templates/templates.controller.ts
import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/create-template.dto';
import { FirebaseAuthGuard } from '../../auth/guards/firebase-auth.guard';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';

@ApiTags('Legal Templates')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('legal/templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new legal notice template' })
  create(@Body() createTemplateDto: CreateTemplateDto, @CurrentOrg() orgId: string) {
    return this.templatesService.create(createTemplateDto, orgId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all legal notice templates' })
  findAll(@CurrentOrg() orgId: string) {
    return this.templatesService.findAll(orgId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a legal notice template by ID' })
  findOne(@Param('id') id: string) {
    return this.templatesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a legal notice template' })
  update(@Param('id') id: string, @Body() updateTemplateDto: UpdateTemplateDto) {
    return this.templatesService.update(id, updateTemplateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a legal notice template' })
  remove(@Param('id') id: string) {
    return this.templatesService.remove(id);
  }
}

# apps/api/src/legal/templates/templates.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LegalTemplate } from '../../database/entities/legal-template.entity';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/create-template.dto';

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(LegalTemplate)
    private templatesRepository: Repository<LegalTemplate>,
  ) {}

  async create(createTemplateDto: CreateTemplateDto, organizationId: string): Promise<LegalTemplate> {
    const template = this.templatesRepository.create({
      ...createTemplateDto,
      organization_id: organizationId,
    });
    return this.templatesRepository.save(template);
  }

  async findAll(organizationId: string): Promise<LegalTemplate[]> {
    return this.templatesRepository.find({
      where: { organization_id: organizationId },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string): Promise<LegalTemplate> {
    const template = await this.templatesRepository.findOne({ where: { id } });
    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }
    return template;
  }

  async update(id: string, updateTemplateDto: UpdateTemplateDto): Promise<LegalTemplate> {
    const template = await this.findOne(id);
    Object.assign(template, updateTemplateDto);
    return this.templatesRepository.save(template);
  }

  async remove(id: string): Promise<void> {
    const result = await this.templatesRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }
  }
}

# apps/api/src/legal/notices/dto/create-notice.dto.ts
import { IsString, IsUUID, IsEnum, IsOptional, IsDateString, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateNoticeDto {
  @ApiProperty()
  @IsUUID()
  template_id: string;

  @ApiProperty()
  @IsUUID()
  tenant_id: string;

  @ApiProperty()
  @IsUUID()
  property_id: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  content: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  legal_deadline?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  amount_owed_cents?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  violation_details?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  cure_period_days?: number;
}

export class UpdateNoticeStatusDto {
  @ApiProperty({ enum: ['draft', 'issued', 'served', 'acknowledged', 'expired', 'complied', 'filed'] })
  @IsEnum(['draft', 'issued', 'served', 'acknowledged', 'expired', 'complied', 'filed'])
  status: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  issued_at?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  served_at?: string;
}

# apps/api/src/legal/notices/notices.controller.ts
import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { NoticesService } from './notices.service';
import { CreateNoticeDto, UpdateNoticeStatusDto } from './dto/create-notice.dto';
import { FirebaseAuthGuard } from '../../auth/guards/firebase-auth.guard';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';

@ApiTags('Legal Notices')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('legal/notices')
export class NoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new legal notice' })
  create(@Body() createNoticeDto: CreateNoticeDto, @CurrentOrg() orgId: string) {
    return this.noticesService.create(createNoticeDto, orgId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all legal notices' })
  findAll(@CurrentOrg() orgId: string) {
    return this.noticesService.findAll(orgId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a legal notice by ID' })
  findOne(@Param('id') id: string) {
    return this.noticesService.findOne(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update legal notice status with validation' })
  @ApiResponse({ status: 409, description: 'Invalid status transition' })
  async updateStatus(@Param('id') id: string, @Body() updateStatusDto: UpdateNoticeStatusDto) {
    const isValidTransition = await this.noticesService.validateStatusTransition(id, updateStatusDto.status);
    if (!isValidTransition) {
      throw new BadRequestException('Invalid status transition');
    }
    return this.noticesService.updateStatus(id, updateStatusDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a legal notice' })
  remove(@Param('id') id: string) {
    return this.noticesService.remove(id);
  }
}

# apps/api/src/legal/notices/notices.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LegalNotice } from '../../database/entities/legal-notice.entity';
import { CreateNoticeDto, UpdateNoticeStatusDto } from './dto/create-notice.dto';

@Injectable()
export class NoticesService {
  private readonly validTransitions = {
    draft: ['issued', 'filed'],
    issued: ['served', 'expired'],
    served: ['acknowledged', 'complied', 'expired', 'filed'],
    acknowledged: ['complied', 'expired', 'filed'],
    expired: ['filed'],
    complied: ['filed'],
    filed: [], // Final state
  };

  constructor(
    @InjectRepository(LegalNotice)
    private noticesRepository: Repository<LegalNotice>,
  ) {}

  async create(createNoticeDto: CreateNoticeDto, organizationId: string): Promise<LegalNotice> {
    const notice = this.noticesRepository.create({
      ...createNoticeDto,
      organization_id: organizationId,
      legal_deadline: createNoticeDto.legal_deadline ? new Date(createNoticeDto.legal_deadline) : undefined,
    });
    return this.noticesRepository.save(notice);
  }

  async findAll(organizationId: string): Promise<LegalNotice[]> {
    return this.noticesRepository.find({
      where: { organization_id: organizationId },
      relations: ['template', 'tenant', 'property', 'service_attempts'],
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string): Promise<LegalNotice> {
    const notice = await this.noticesRepository.findOne({
      where: { id },
      relations: ['template', 'tenant', 'property', 'service_attempts'],
    });
    if (!notice) {
      throw new NotFoundException(`Legal notice with ID ${id} not found`);
    }
    return notice;
  }

  async validateStatusTransition(id: string, newStatus: string): Promise<boolean> {
    const notice = await this.findOne(id);
    const validNextStates = this.validTransitions[notice.status] || [];
    return validNextStates.includes(newStatus);
  }

  async updateStatus(id: string, updateStatusDto: UpdateNoticeStatusDto): Promise<LegalNotice> {
    const notice = await this.findOne(id);
    
    // Update timestamps based on status
    const updates: Partial<LegalNotice> = { status: updateStatusDto.status };
    
    if (updateStatusDto.status === 'issued' && !notice.issued_at) {
      updates.issued_at = updateStatusDto.issued_at ? new Date(updateStatusDto.issued_at) : new Date();
    }
    
    if (updateStatusDto.status === 'served' && !notice.served_at) {
      updates.served_at = updateStatusDto.served_at ? new Date(updateStatusDto.served_at) : new Date();
    }

    Object.assign(notice, updates);
    return this.noticesRepository.save(notice);
  }

  async remove(id: string): Promise<void> {
    const result = await this.noticesRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Legal notice with ID ${id} not found`);
    }
  }
}

# apps/api/src/legal/service-attempts/dto/create-service-attempt.dto.ts
import { IsString, IsUUID, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateServiceAttemptDto {
  @ApiProperty()
  @IsUUID()
  notice_id: string;

  @ApiProperty()
  @IsString()
  server_name: string;

  @ApiProperty({ enum: ['personal', 'substitute', 'posting', 'certified_mail', 'email', 'other'] })
  @IsEnum(['personal', 'substitute', 'posting', 'certified_mail', 'email', 'other'])
  method: string;

  @ApiProperty({ enum: ['served', 'refused', 'not_home', 'invalid_address', 'other'] })
  @IsEnum(['served', 'refused', 'not_home', 'invalid_address', 'other'])
  result: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  evidence_url?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  attempt_time?: string;
}

export class UpdateServiceAttemptDto extends CreateServiceAttemptDto {}

# apps/api/src/legal/service-attempts/service-attempts.controller.ts
import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ServiceAttemptsService } from './service-attempts.service';
import { CreateServiceAttemptDto, UpdateServiceAttemptDto } from './dto/create-service-attempt.dto';
import { FirebaseAuthGuard } from '../../auth/guards/firebase-auth.guard';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';

@ApiTags('Service Attempts')
@ApiBearerAuth()
@UseGuards(FirebaseAuthGuard)
@Controller('legal/service-attempts')
export class ServiceAttemptsController {
  constructor(private readonly serviceAttemptsService: ServiceAttemptsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new service attempt' })
  create(@Body() createServiceAttemptDto: CreateServiceAttemptDto, @CurrentOrg() orgId: string) {
    return this.serviceAttemptsService.create(createServiceAttemptDto, orgId);
  }

  @Get()
  @ApiOperation({ summary: 'Get service attempts' })
  @ApiQuery({ name: 'notice_id', required: false, description: 'Filter by notice ID' })
  findAll(@CurrentOrg() orgId: string, @Query('notice_id') noticeId?: string) {
    return this.serviceAttemptsService.findAll(orgId, noticeId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a service attempt by ID' })
  findOne(@Param('id') id: string) {
    return this.serviceAttemptsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a service attempt' })
  update(@Param('id') id: string, @Body() updateServiceAttemptDto: UpdateServiceAttemptDto) {
    return this.serviceAttemptsService.update(id, updateServiceAttemptDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a service attempt' })
  remove(@Param('id') id: string) {
    return this.serviceAttemptsService.remove(id);
  }
}

# apps/api/src/legal/service-attempts/service-attempts.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceAttempt } from '../../database/entities/service-attempt.entity';
import { CreateServiceAttemptDto, UpdateServiceAttemptDto } from './dto/create-service-attempt.dto';

@Injectable()
export class ServiceAttemptsService {
  constructor(
    @InjectRepository(ServiceAttempt)
    private serviceAttemptsRepository: Repository<ServiceAttempt>,
  ) {}

  async create(createServiceAttemptDto: CreateServiceAttemptDto, organizationId: string): Promise<ServiceAttempt> {
    const serviceAttempt = this.serviceAttemptsRepository.create({
      ...createServiceAttemptDto,
      organization_id: organizationId,
      attempt_time: createServiceAttemptDto.attempt_time ? new Date(createServiceAttemptDto.attempt_time) : new Date(),
    });
    return this.serviceAttemptsRepository.save(serviceAttempt);
  }

  async findAll(organizationId: string, noticeId?: string): Promise<ServiceAttempt[]> {
    const where: any = { organization_id: organizationId };
    if (noticeId) {
      where.notice_id = noticeId;
    }

    return this.serviceAttemptsRepository.find({
      where,
      relations: ['notice'],
      order: { attempt_time: 'DESC' },
    });
  }

  async findOne(id: string): Promise<ServiceAttempt> {
    const serviceAttempt = await this.serviceAttemptsRepository.findOne({
      where: { id },
      relations: ['notice'],
    });
    if (!serviceAttempt) {
      throw new NotFoundException(`Service attempt with ID ${id} not found`);
    }
    return serviceAttempt;
  }

  async update(id: string, updateServiceAttemptDto: UpdateServiceAttemptDto): Promise<ServiceAttempt> {
    const serviceAttempt = await this.findOne(id);
    Object.assign(serviceAttempt, {
      ...updateServiceAttemptDto,
      attempt_time: updateServiceAttemptDto.attempt_time ? new Date(updateServiceAttemptDto.attempt_time) : serviceAttempt.attempt_time,
    });
    return this.serviceAttemptsRepository.save(serviceAttempt);
  }

  async remove(id: string): Promise<void> {
    const result = await this.serviceAttemptsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Service attempt with ID ${id} not found`);
    }
  }
}