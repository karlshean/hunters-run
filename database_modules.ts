# apps/api/src/database/database.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Organization } from './entities/organization.entity';
import { Property } from './entities/property.entity';
import { Unit } from './entities/unit.entity';
import { Tenant } from './entities/tenant.entity';
import { LegalTemplate } from './entities/legal-template.entity';
import { LegalNotice } from './entities/legal-notice.entity';
import { ServiceAttempt } from './entities/service-attempt.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get('DATABASE_URL'),
        entities: [__dirname + '/entities/*.entity{.ts,.js}'],
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        synchronize: false,
        logging: configService.get('NODE_ENV') === 'development',
        ssl: configService.get('NODE_ENV') === 'production' 
          ? { rejectUnauthorized: false } 
          : false,
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([
      Organization,
      Property, 
      Unit,
      Tenant,
      LegalTemplate,
      LegalNotice,
      ServiceAttempt,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}

# apps/api/src/database/data-source.ts
import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/entities/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});

# apps/api/src/database/entities/organization.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('organizations', { schema: 'platform' })
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: 'property_management' })
  type: string;

  @Column({ type: 'jsonb', default: {} })
  settings: Record<string, any>;

  @CreateDateColumn()
  created_at: Date;
}

# apps/api/src/database/entities/property.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Unit } from './unit.entity';

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

  @Column({ default: 'apartment_complex' })
  property_type: string;

  @Column({ default: 0 })
  total_units: number;

  @Column({ type: 'text', array: true, default: [] })
  amenities: string[];

  @Column({ nullable: true })
  description: string;

  @Column({ default: 'active' })
  status: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => Unit, unit => unit.property)
  units: Unit[];
}

# apps/api/src/database/entities/unit.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Property } from './property.entity';

@Entity('units', { schema: 'hr' })
export class Unit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  property_id: string;

  @Column()
  organization_id: string;

  @Column()
  unit_number: string;

  @Column({ default: 0 })
  bedrooms: number;

  @Column({ type: 'decimal', precision: 3, scale: 1, default: 0 })
  bathrooms: number;

  @Column({ type: 'bigint', nullable: true })
  market_rent_cents: number;

  @Column({ default: 'draft' })
  status: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Property, property => property.units)
  @JoinColumn({ name: 'property_id' })
  property: Property;
}

# apps/api/src/database/entities/tenant.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('tenants', { schema: 'hr' })
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organization_id: string;

  @Column()
  first_name: string;

  @Column()
  last_name: string;

  @Column({ type: 'citext', nullable: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ default: 'prospect' })
  status: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

# apps/api/src/database/entities/legal-template.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('notice_templates', { schema: 'hr' })
export class LegalTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organization_id: string;

  @Column()
  name: string;

  @Column()
  notice_type: string;

  @Column()
  body: string;

  @Column({ default: 1 })
  version: number;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;
}

# apps/api/src/database/entities/legal-notice.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { ServiceAttempt } from './service-attempt.entity';
import { LegalTemplate } from './legal-template.entity';
import { Tenant } from './tenant.entity';
import { Property } from './property.entity';

@Entity('legal_notices', { schema: 'hr' })
export class LegalNotice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organization_id: string;

  @Column()
  template_id: string;

  @Column()
  tenant_id: string;

  @Column()
  property_id: string;

  @Column({ default: 'draft' })
  status: string;

  @Column()
  title: string;

  @Column()
  content: string;

  @Column({ type: 'date', nullable: true })
  legal_deadline: Date;

  @Column({ type: 'bigint', nullable: true })
  amount_owed_cents: number;

  @Column({ nullable: true })
  violation_details: string;

  @Column({ nullable: true })
  cure_period_days: number;

  @Column({ type: 'timestamptz', nullable: true })
  issued_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  served_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => LegalTemplate)
  @JoinColumn({ name: 'template_id' })
  template: LegalTemplate;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @ManyToOne(() => Property)
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @OneToMany(() => ServiceAttempt, attempt => attempt.notice)
  service_attempts: ServiceAttempt[];
}

# apps/api/src/database/entities/service-attempt.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { LegalNotice } from './legal-notice.entity';

@Entity('service_attempts', { schema: 'hr' })
export class ServiceAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organization_id: string;

  @Column()
  notice_id: string;

  @Column()
  server_name: string;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  attempt_time: Date;

  @Column()
  method: string;

  @Column()
  result: string;

  @Column({ nullable: true })
  evidence_url: string;

  @Column({ nullable: true })
  notes: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => LegalNotice, notice => notice.service_attempts)
  @JoinColumn({ name: 'notice_id' })
  notice: LegalNotice;
}

# apps/api/src/database/migrations/1704000000000-InitialSchema.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1704000000000 implements MigrationInterface {
  name = 'InitialSchema1704000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable extensions
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "citext"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "postgis"`);

    // Create schemas
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "platform"`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "hr"`);

    // Platform tables
    await queryRunner.query(`
      CREATE TABLE "platform"."organizations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "type" text NOT NULL DEFAULT 'property_management',
        "settings" jsonb DEFAULT '{}',
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    // HR tables
    await queryRunner.query(`
      CREATE TABLE "hr"."properties" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "name" text NOT NULL,
        "address" text NOT NULL,
        "city" text NOT NULL,
        "state" text NOT NULL,
        "zip_code" text NOT NULL,
        "country" text DEFAULT 'US',
        "property_type" text DEFAULT 'apartment_complex',
        "total_units" integer DEFAULT 0,
        "amenities" text[] DEFAULT '{}',
        "description" text,
        "status" text DEFAULT 'active',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "hr"."units" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "property_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "unit_number" text NOT NULL,
        "bedrooms" integer DEFAULT 0,
        "bathrooms" decimal(3,1) DEFAULT 0,
        "market_rent_cents" bigint,
        "status" text DEFAULT 'draft',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_units_property" FOREIGN KEY ("property_id") REFERENCES "hr"."properties"("id") ON DELETE CASCADE,
        CONSTRAINT "uk_units_property_number" UNIQUE ("property_id", "unit_number")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "hr"."tenants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "first_name" text NOT NULL,
        "last_name" text NOT NULL,
        "email" citext,
        "phone" text,
        "status" text DEFAULT 'prospect',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    // Enable RLS
    await queryRunner.query(`ALTER TABLE "hr"."properties" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "hr"."units" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "hr"."tenants" ENABLE ROW LEVEL SECURITY`);

    // Create RLS policies
    await queryRunner.query(`
      CREATE POLICY "properties_org_isolation" ON "hr"."properties"
      USING (organization_id = current_setting('app.current_org', true)::uuid)
    `);

    await queryRunner.query(`
      CREATE POLICY "units_org_isolation" ON "hr"."units"
      USING (organization_id = current_setting('app.current_org', true)::uuid)
    `);

    await queryRunner.query(`
      CREATE POLICY "tenants_org_isolation" ON "hr"."tenants"
      USING (organization_id = current_setting('app.current_org', true)::uuid)
    `);

    // Indexes
    await queryRunner.query(`CREATE INDEX "idx_properties_org_status" ON "hr"."properties"("organization_id", "status")`);
    await queryRunner.query(`CREATE INDEX "idx_units_property_status" ON "hr"."units"("property_id", "status")`);
    await queryRunner.query(`CREATE INDEX "idx_tenants_org_status" ON "hr"."tenants"("organization_id", "status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP SCHEMA "hr" CASCADE`);
    await queryRunner.query(`DROP SCHEMA "platform" CASCADE`);
  }
}

# apps/api/src/database/migrations/1704000001000-LegalNoticesPatch.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class LegalNoticesPatch1704000001000 implements MigrationInterface {
  name = 'LegalNoticesPatch1704000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Notice templates
    await queryRunner.query(`
      CREATE TABLE "hr"."notice_templates" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "name" text NOT NULL,
        "notice_type" text NOT NULL,
        "body" text NOT NULL,
        "version" integer DEFAULT 1,
        "is_active" boolean DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_notice_type" CHECK (notice_type IN ('pay_or_quit', 'cure_or_quit', 'unconditional_quit', 'lease_violation', 'non_renewal', 'rent_increase', 'entry_notice', 'other'))
      )
    `);

    // Legal notices
    await queryRunner.query(`
      CREATE TABLE "hr"."legal_notices" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "template_id" uuid NOT NULL,
        "tenant_id" uuid NOT NULL,
        "property_id" uuid NOT NULL,
        "status" text DEFAULT 'draft',
        "title" text NOT NULL,
        "content" text NOT NULL,
        "legal_deadline" date,
        "amount_owed_cents" bigint,
        "violation_details" text,
        "cure_period_days" integer,
        "issued_at" timestamptz,
        "served_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_legal_notices_template" FOREIGN KEY ("template_id") REFERENCES "hr"."notice_templates"("id"),
        CONSTRAINT "fk_legal_notices_tenant" FOREIGN KEY ("tenant_id") REFERENCES "hr"."tenants"("id"),
        CONSTRAINT "fk_legal_notices_property" FOREIGN KEY ("property_id") REFERENCES "hr"."properties"("id"),
        CONSTRAINT "chk_legal_status" CHECK (status IN ('draft', 'issued', 'served', 'acknowledged', 'expired', 'complied', 'filed'))
      )
    `);

    // Service attempts
    await queryRunner.query(`
      CREATE TABLE "hr"."service_attempts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "notice_id" uuid NOT NULL,
        "server_name" text NOT NULL,
        "attempt_time" timestamptz DEFAULT CURRENT_TIMESTAMP,
        "method" text NOT NULL,
        "result" text NOT NULL,
        "evidence_url" text,
        "notes" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_service_attempts_notice" FOREIGN KEY ("notice_id") REFERENCES "hr"."legal_notices"("id") ON DELETE CASCADE,
        CONSTRAINT "chk_service_method" CHECK (method IN ('personal', 'substitute', 'posting', 'certified_mail', 'email', 'other')),
        CONSTRAINT "chk_service_result" CHECK (result IN ('served', 'refused', 'not_home', 'invalid_address', 'other'))
      )
    `);

    // Enable RLS
    await queryRunner.query(`ALTER TABLE "hr"."notice_templates" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "hr"."legal_notices" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "hr"."service_attempts" ENABLE ROW LEVEL SECURITY`);

    // RLS policies
    await queryRunner.query(`
      CREATE POLICY "notice_templates_org_isolation" ON "hr"."notice_templates"
      USING (organization_id = current_setting('app.current_org', true)::uuid)
    `);

    await queryRunner.query(`
      CREATE POLICY "legal_notices_org_isolation" ON "hr"."legal_notices"
      USING (organization_id = current_setting('app.current_org', true)::uuid)
    `);

    await queryRunner.query(`
      CREATE POLICY "service_attempts_org_isolation" ON "hr"."service_attempts"
      USING (organization_id = current_setting('app.current_org', true)::uuid)
    `);

    // Indexes
    await queryRunner.query(`CREATE INDEX "idx_notice_templates_org_type" ON "hr"."notice_templates"("organization_id", "notice_type", "is_active")`);
    await queryRunner.query(`CREATE INDEX "idx_legal_notices_tenant_status" ON "hr"."legal_notices"("tenant_id", "status", "created_at")`);
    await queryRunner.query(`CREATE INDEX "idx_service_attempts_notice" ON "hr"."service_attempts"("notice_id", "attempt_time")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "hr"."service_attempts"`);
    await queryRunner.query(`DROP TABLE "hr"."legal_notices"`);
    await queryRunner.query(`DROP TABLE "hr"."notice_templates"`);
  }
}

# apps/api/src/database/seeds/seed.ts
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { Organization } from '../entities/organization.entity';
import { Property } from '../entities/property.entity';
import { Unit } from '../entities/unit.entity';
import { Tenant } from '../entities/tenant.entity';
import { LegalTemplate } from '../entities/legal-template.entity';

config();

const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/../entities/*.entity{.ts,.js}'],
  synchronize: false,
  logging: false,
});

async function seed() {
  await dataSource.initialize();
  console.log('🌱 Starting database seed...');

  // Create organizations
  const orgA = dataSource.getRepository(Organization).create({
    name: 'Hunters Run Properties',
    type: 'property_management',
  });
  await dataSource.getRepository(Organization).save(orgA);

  const orgB = dataSource.getRepository(Organization).create({
    name: 'Test Property Management',
    type: 'property_management',
  });
  await dataSource.getRepository(Organization).save(orgB);

  console.log(`✅ Created organizations: ${orgA.id}, ${orgB.id}`);

  // Set RLS context for Org A and create data
  await dataSource.query(`SET app.current_org = '${orgA.id}'`);

  const propertyA = dataSource.getRepository(Property).create({
    organization_id: orgA.id,
    name: 'Hunters Run Apartments',
    address: '123 Main Street',
    city: 'Austin',
    state: 'TX',
    zip_code: '78701',
    property_type: 'apartment_complex',
    total_units: 64,
    amenities: ['pool', 'gym', 'parking'],
    description: 'Luxury apartment complex in downtown Austin',
  });
  await dataSource.getRepository(Property).save(propertyA);

  const unitA = dataSource.getRepository(Unit).create({
    property_id: propertyA.id,
    organization_id: orgA.id,
    unit_number: 'A1',
    bedrooms: 2,
    bathrooms: 2,
    market_rent_cents: 180000, // $1800
    status: 'occupied',
  });
  await dataSource.getRepository(Unit).save(unitA);

  const tenantA = dataSource.getRepository(Tenant).create({
    organization_id: orgA.id,
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@email.com',
    phone: '+1-555-0101',
    status: 'active_tenant',
  });
  await dataSource.getRepository(Tenant).save(tenantA);

  // Set RLS context for Org B and create data
  await dataSource.query(`SET app.current_org = '${orgB.id}'`);

  const propertyB = dataSource.getRepository(Property).create({
    organization_id: orgB.id,
    name: 'Test Property',
    address: '456 Oak Avenue',
    city: 'Dallas',
    state: 'TX',
    zip_code: '75201',
    property_type: 'single_family',
    total_units: 1,
    amenities: ['parking'],
    description: 'Single family rental home',
  });
  await dataSource.getRepository(Property).save(propertyB);

  const unitB = dataSource.getRepository(Unit).create({
    property_id: propertyB.id,
    organization_id: orgB.id,
    unit_number: '1',
    bedrooms: 3,
    bathrooms: 2,
    market_rent_cents: 220000, // $2200
    status: 'available',
  });
  await dataSource.getRepository(Unit).save(unitB);

  const tenantB = dataSource.getRepository(Tenant).create({
    organization_id: orgB.id,
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'jane.smith@email.com',
    phone: '+1-555-0102',
    status: 'prospect',
  });
  await dataSource.getRepository(Tenant).save(tenantB);

  // Create legal templates for both orgs
  await dataSource.query(`SET app.current_org = '${orgA.id}'`);
  const templateA = dataSource.getRepository(LegalTemplate).create({
    organization_id: orgA.id,
    name: 'Standard Pay or Quit Notice',
    notice_type: 'pay_or_quit',
    body: 'TO: {{tenant_name}}\n\nYOU ARE HEREBY NOTIFIED that rent is due in the amount of ${{amount_owed}}.\n\nYou have {{cure_period_days}} days to pay or quit.',
  });
  await dataSource.getRepository(LegalTemplate).save(templateA);

  await dataSource.query(`SET app.current_org = '${orgB.id}'`);
  const templateB = dataSource.getRepository(LegalTemplate).create({
    organization_id: orgB.id,
    name: 'Test Pay or Quit Notice',
    notice_type: 'pay_or_quit',
    body: 'TO: {{tenant_name}}\n\nPay rent of ${{amount_owed}} within {{cure_period_days}} days.',
  });
  await dataSource.getRepository(LegalTemplate).save(templateB);

  console.log('✅ Created properties, units, tenants, and legal templates');
  console.log(`   Org A: Property ${propertyA.id}, Unit ${unitA.id}, Tenant ${tenantA.id}`);
  console.log(`   Org B: Property ${propertyB.id}, Unit ${unitB.id}, Tenant ${tenantB.id}`);

  await dataSource.destroy();
  console.log('🎉 Database seed completed successfully!');
}

seed().catch(error => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
});