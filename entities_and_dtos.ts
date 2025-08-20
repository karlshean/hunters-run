// apps/api/src/modules/platform/users/entities/user.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Membership } from '../../memberships/entities/membership.entity';

@Entity('users', { schema: 'platform' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'citext', unique: true })
  email: string;

  @Column({ type: 'timestamptz', nullable: true })
  email_verified_at: Date | null;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  full_name: string;

  @Column({ default: 'en' })
  preferred_language: string;

  @Column({ default: false })
  is_minor: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  parental_consent_at: Date | null;

  @Column({ nullable: true })
  device_fingerprint: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => Membership, membership => membership.user)
  memberships: Membership[];
}

// apps/api/src/modules/platform/organizations/entities/organization.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { Membership } from '../../memberships/entities/membership.entity';

@Entity('organizations', { schema: 'platform' })
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  type: string;

  @Column({ type: 'jsonb', default: {} })
  settings: Record<string, any>;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => Membership, membership => membership.organization)
  memberships: Membership[];
}

// apps/api/src/modules/platform/roles/entities/role.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToMany, JoinTable } from 'typeorm';
import { Membership } from '../../memberships/entities/membership.entity';
import { Permission } from './permission.entity';

@Entity('roles', { schema: 'platform' })
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  key: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column()
  product_key: string;

  @OneToMany(() => Membership, membership => membership.role)
  memberships: Membership[];

  @ManyToMany(() => Permission)
  @JoinTable({ name: 'role_permissions' })
  permissions: Permission[];
}

// apps/api/src/modules/platform/roles/entities/permission.entity.ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('permissions', { schema: 'platform' })
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  key: string;

  @Column()
  description: string;

  @Column()
  product_key: string;
}

// apps/api/src/modules/platform/memberships/entities/membership.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { Role } from '../../roles/entities/role.entity';

@Entity('memberships', { schema: 'platform' })
export class Membership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @Column()
  organization_id: string;

  @Column()
  role_id: string;

  @Column()
  product_key: string;

  @Column({ default: 'active' })
  status: string;

  @Column({ nullable: true })
  invited_by: string;

  @Column({ type: 'timestamptz', nullable: true })
  invited_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  joined_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => User, user => user.memberships)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Organization, org => org.memberships)
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @ManyToOne(() => Role, role => role.memberships)
  @JoinColumn({ name: 'role_id' })
  role: Role;
}

// apps/api/src/modules/hunters-run/properties/entities/property.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Unit } from '../../units/entities/unit.entity';
import { WorkOrder } from '../../maintenance/entities/work-order.entity';

@Entity('properties', { schema: 'hr' })
export class Property {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organization_id: string;

  @Column()
  name: string;

  @Column()
  address: string;

  @Column()
  city: string;

  @Column()
  state: string;

  @Column()
  zip_code: string;

  @Column({ default: 'US' })
  country: string;

  @Column()
  property_type: string;

  @Column({ default: 0 })
  total_units: number;

  @Column({ nullable: true })
  year_built: number;

  @Column({ nullable: true })
  square_footage: number;

  @Column({ nullable: true })
  lot_size_sqft: number;

  @Column({ type: 'text', array: true, default: [] })
  amenities: string[];

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326, nullable: true })
  location: string;

  @Column({ default: 'active' })
  status: string;

  @Column({ type: 'jsonb', default: {} })
  settings: Record<string, any>;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => Unit, unit => unit.property)
  units: Unit[];

  @OneToMany(() => WorkOrder, workOrder => workOrder.property)
  work_orders: WorkOrder[];
}

// apps/api/src/modules/hunters-run/units/entities/unit.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Property } from '../../properties/entities/property.entity';
import { WorkOrder } from '../../maintenance/entities/work-order.entity';
import { Lease } from '../../leases/entities/lease.entity';

@Entity('units', { schema: 'hr' })
export class Unit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  property_id: string;

  @Column({ nullable: true })
  building_id: string;

  @Column()
  organization_id: string;

  @Column()
  unit_number: string;

  @Column({ nullable: true })
  floor: number;

  @Column({ default: 0 })
  bedrooms: number;

  @Column({ type: 'decimal', precision: 3, scale: 1, default: 0 })
  bathrooms: number;

  @Column({ nullable: true })
  square_footage: number;

  @Column({ type: 'bigint', nullable: true })
  market_rent_cents: number;

  @Column({ type: 'bigint', nullable: true })
  base_rent_cents: number;

  @Column({ type: 'bigint', nullable: true })
  deposit_cents: number;

  @Column({ type: 'bigint', default: 0 })
  pet_deposit_cents: number;

  @Column({ type: 'text', array: true, default: [] })
  amenities: string[];

  @Column({ nullable: true })
  description: string;

  @Column({ default: false })
  move_in_ready: boolean;

  @Column({ type: 'date', nullable: true })
  last_renovated: Date;

  @Column({ default: 'draft' })
  status: string;

  @Column({ type: 'date', nullable: true })
  availability_date: Date;

  @Column({ type: 'text', array: true, default: [] })
  photos: string[];

  @Column({ nullable: true })
  virtual_tour_url: string;

  @Column({ nullable: true })
  notes: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Property, property => property.units)
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @OneToMany(() => WorkOrder, workOrder => workOrder.unit)
  work_orders: WorkOrder[];

  @OneToMany(() => Lease, lease => lease.unit)
  leases: Lease[];
}

// apps/api/src/modules/hunters-run/tenants/entities/tenant.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Lease } from '../../leases/entities/lease.entity';
import { WorkOrder } from '../../maintenance/entities/work-order.entity';

@Entity('tenants', { schema: 'hr' })
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organization_id: string;

  @Column({ nullable: true })
  user_id: string;

  @Column()
  first_name: string;

  @Column()
  last_name: string;

  @Column({ type: 'citext', nullable: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'date', nullable: true })
  date_of_birth: Date;

  @Column({ nullable: true })
  ssn_last_four: string;

  @Column({ nullable: true })
  emergency_contact_name: string;

  @Column({ nullable: true })
  emergency_contact_phone: string;

  @Column({ nullable: true })
  employment_status: string;

  @Column({ nullable: true })
  employer_name: string;

  @Column({ type: 'bigint', nullable: true })
  monthly_income_cents: number;

  @Column({ default: 'en' })
  preferred_language: string;

  @Column({ type: 'jsonb', default: { sms: true, email: true, voice: false } })
  communication_preferences: Record<string, boolean>;

  @Column({ default: 'prospect' })
  status: string;

  @Column({ nullable: true })
  credit_score: number;

  @Column({ nullable: true })
  background_check_status: string;

  @Column({ type: 'date', nullable: true })
  background_check_date: Date;

  @Column({ nullable: true })
  notes: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => Lease, lease => lease.primary_tenant)
  leases: Lease[];

  @OneToMany(() => WorkOrder, workOrder => workOrder.tenant)
  work_orders: WorkOrder[];
}

// apps/api/src/modules/hunters-run/maintenance/entities/work-order.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Property } from '../../properties/entities/property.entity';
import { Unit } from '../../units/entities/unit.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Evidence } from './evidence.entity';

@Entity('work_orders', { schema: 'hr' })
export class WorkOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organization_id: string;

  @Column({ unique: true })
  work_order_number: string;

  @Column()
  property_id: string;

  @Column()
  unit_id: string;

  @Column({ nullable: true })
  tenant_id: string;

  @Column({ nullable: true })
  lease_id: string;

  @Column()
  category: string;

  @Column()
  priority: string;

  @Column()
  status: string;

  @Column()
  title: string;

  @Column()
  description: string;

  @Column({ nullable: true })
  location_details: string;

  @Column({ nullable: true })
  tenant_phone: string;

  @Column({ nullable: true })
  tenant_access_notes: string;

  @Column({ type: 'bigint', nullable: true })
  estimated_cost_cents: number;

  @Column({ type: 'bigint', nullable: true })
  actual_cost_cents: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  labor_hours: number;

  @Column({ type: 'bigint', nullable: true })
  parts_cost_cents: number;

  @Column({ nullable: true })
  vendor_invoice_number: string;

  @Column({ type: 'date', nullable: true })
  warranty_expires_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  scheduled_start: Date;

  @Column({ type: 'timestamptz', nullable: true })
  scheduled_end: Date;

  @Column({ type: 'timestamptz', nullable: true })
  started_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at: Date;

  @Column({ nullable: true })
  technician_id: string;

  @Column({ nullable: true })
  assigned_by: string;

  @Column({ nullable: true })
  created_by: string;

  @Column({ nullable: true })
  tenant_satisfaction_rating: number;

  @Column({ nullable: true })
  tenant_feedback: string;

  @Column({ nullable: true })
  internal_notes: string;

  @Column({ type: 'date', nullable: true })
  follow_up_date: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Property, property => property.work_orders)
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @ManyToOne(() => Unit, unit => unit.work_orders)
  @JoinColumn({ name: 'unit_id' })
  unit: Unit;

  @ManyToOne(() => Tenant, tenant => tenant.work_orders)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @OneToMany(() => Evidence, evidence => evidence.work_order)
  evidence: Evidence[];
}

// apps/api/src/modules/hunters-run/maintenance/entities/evidence.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { WorkOrder } from './work-order.entity';

@Entity('evidence', { schema: 'hr' })
export class Evidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organization_id: string;

  @Column()
  work_order_id: string;

  @Column()
  file_asset_id: string;

  @Column()
  evidence_type: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  taken_by: string;

  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326, nullable: true })
  gps_coordinates: string;

  @Column({ default: false })
  timestamp_verified: boolean;

  @Column({ default: false })
  legal_hold: boolean;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => WorkOrder, workOrder => workOrder.evidence)
  @JoinColumn({ name: 'work_order_id' })
  work_order: WorkOrder;
}

// apps/api/src/modules/hunters-run/maintenance/dto/create-work-order.dto.ts
import { IsString, IsUUID, IsEnum, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWorkOrderDto {
  @ApiProperty({ description: 'Property ID where work is needed' })
  @IsUUID()
  property_id: string;

  @ApiProperty({ description: 'Unit ID where work is needed' })
  @IsUUID()
  unit_id: string;

  @ApiProperty({ description: 'Tenant ID who submitted request', required: false })
  @IsOptional()
  @IsUUID()
  tenant_id?: string;

  @ApiProperty({ description: 'Work order category', enum: ['plumbing', 'electrical', 'hvac', 'appliances', 'pest_control', 'cleaning', 'painting', 'flooring', 'windows', 'doors', 'general', 'emergency'] })
  @IsEnum(['plumbing', 'electrical', 'hvac', 'appliances', 'pest_control', 'cleaning', 'painting', 'flooring', 'windows', 'doors', 'general', 'emergency'])
  category: string;

  @ApiProperty({ description: 'Priority level', enum: ['low', 'normal', 'high', 'urgent', 'emergency'] })
  @IsEnum(['low', 'normal', 'high', 'urgent', 'emergency'])
  priority: string;

  @ApiProperty({ description: 'Short title describing the issue' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Detailed description of the problem' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Specific location details within unit', required: false })
  @IsOptional()
  @IsString()
  location_details?: string;

  @ApiProperty({ description: 'Tenant contact phone for this request', required: false })
  @IsOptional()
  @IsString()
  tenant_phone?: string;

  @ApiProperty({ description: 'Special access instructions', required: false })
  @IsOptional()
  @IsString()
  tenant_access_notes?: string;
}

// apps/api/src/modules/hunters-run/maintenance/dto/update-work-order.dto.ts
import { IsString, IsUUID, IsEnum, IsOptional, IsInt, Min, Max, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateWorkOrderDto {
  @ApiProperty({ description: 'Work order status', required: false })
  @IsOptional()
  @IsEnum(['submitted', 'triaged', 'rejected', 'escalated', 'emergency', 'assigned', 'scheduled', 'cancelled', 'rescheduled', 'in_progress', 'on_hold', 'needs_parts', 'reassigned', 'completed', 'verified', 'tenant_approved', 'follow_up_needed', 'reopened', 'closed'])
  status?: string;

  @ApiProperty({ description: 'Assigned technician ID', required: false })
  @IsOptional()
  @IsUUID()
  technician_id?: string;

  @ApiProperty({ description: 'Estimated cost in cents', required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  estimated_cost_cents?: number;

  @ApiProperty({ description: 'Actual cost in cents', required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  actual_cost_cents?: number;

  @ApiProperty({ description: 'Labor hours spent', required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  labor_hours?: number;

  @ApiProperty({ description: 'Parts cost in cents', required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  parts_cost_cents?: number;

  @ApiProperty({ description: 'Vendor invoice number', required: false })
  @IsOptional()
  @IsString()
  vendor_invoice_number?: string;

  @ApiProperty({ description: 'Scheduled start time', required: false })
  @IsOptional()
  @IsDateString()
  scheduled_start?: string;

  @ApiProperty({ description: 'Scheduled end time', required: false })
  @IsOptional()
  @IsDateString()
  scheduled_end?: string;

  @ApiProperty({ description: 'Internal notes for staff', required: false })
  @IsOptional()
  @IsString()
  internal_notes?: string;

  @ApiProperty({ description: 'Tenant satisfaction rating 1-5', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  tenant_satisfaction_rating?: number;

  @ApiProperty({ description: 'Tenant feedback text', required: false })
  @IsOptional()
  @IsString()
  tenant_feedback?: string;
}