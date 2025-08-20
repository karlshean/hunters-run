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
  cure