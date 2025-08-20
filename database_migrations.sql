-- migrations/001_initial_schema.sql
-- Hunters Run Platform Database Schema
-- Unified PostgreSQL with RLS for multi-tenant isolation

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS postgis;

-- ========== PLATFORM SCHEMA ==========
CREATE SCHEMA IF NOT EXISTS platform;

-- Users table
CREATE TABLE platform.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT UNIQUE NOT NULL,
  email_verified_at TIMESTAMPTZ,
  phone TEXT,
  full_name TEXT,
  preferred_language TEXT DEFAULT 'en' CHECK (preferred_language IN ('en', 'es')),
  is_minor BOOLEAN DEFAULT false,
  parental_consent_at TIMESTAMPTZ,
  device_fingerprint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Organizations table
CREATE TABLE platform.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('property_management', 'parish', 'household', 'fleet', 'school')),
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Roles table
CREATE TABLE platform.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  product_key TEXT NOT NULL
);

-- Permissions table
CREATE TABLE platform.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  product_key TEXT NOT NULL
);

-- Role permissions junction
CREATE TABLE platform.role_permissions (
  role_id UUID REFERENCES platform.roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES platform.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- User organization memberships
CREATE TABLE platform.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES platform.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES platform.organizations(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES platform.roles(id),
  product_key TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('invited', 'active', 'suspended', 'terminated')),
  invited_by UUID REFERENCES platform.users(id),
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id, product_key)
);

-- File assets
CREATE TABLE platform.file_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  product_key TEXT NOT NULL,
  owner_user_id UUID REFERENCES platform.users(id) ON DELETE SET NULL,
  storage_key TEXT NOT NULL,
  original_filename TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  sha256_hash TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== HUNTERS RUN SCHEMA ==========
CREATE SCHEMA IF NOT EXISTS hr;

-- Properties
CREATE TABLE hr.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  country TEXT DEFAULT 'US',
  property_type TEXT NOT NULL CHECK (property_type IN ('apartment_complex', 'single_family', 'duplex', 'commercial')),
  total_units INTEGER NOT NULL DEFAULT 0,
  year_built INTEGER,
  square_footage INTEGER,
  lot_size_sqft INTEGER,
  amenities TEXT[],
  description TEXT,
  location GEOGRAPHY(POINT, 4326),
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'inactive', 'archived')),
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Buildings
CREATE TABLE hr.buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES hr.properties(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  building_name TEXT NOT NULL,
  address TEXT,
  floors INTEGER DEFAULT 1,
  units_per_floor INTEGER,
  amenities TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Units
CREATE TABLE hr.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES hr.properties(id) ON DELETE CASCADE,
  building_id UUID REFERENCES hr.buildings(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL,
  unit_number TEXT NOT NULL,
  floor INTEGER,
  bedrooms INTEGER DEFAULT 0,
  bathrooms DECIMAL(3,1) DEFAULT 0,
  square_footage INTEGER,
  market_rent_cents BIGINT,
  base_rent_cents BIGINT,
  deposit_cents BIGINT,
  pet_deposit_cents BIGINT DEFAULT 0,
  amenities TEXT[],
  description TEXT,
  move_in_ready BOOLEAN DEFAULT false,
  last_renovated DATE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'available', 'occupied', 'notice_given', 'vacating', 'make_ready', 'maintenance', 'off_market', 'inactive')),
  availability_date DATE,
  photos TEXT[],
  virtual_tour_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(property_id, unit_number)
);

-- Tenants
CREATE TABLE hr.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID REFERENCES platform.users(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email CITEXT,
  phone TEXT,
  date_of_birth DATE,
  ssn_last_four TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  employment_status TEXT CHECK (employment_status IN ('employed', 'self_employed', 'student', 'retired', 'unemployed')),
  employer_name TEXT,
  monthly_income_cents BIGINT,
  preferred_language TEXT DEFAULT 'en' CHECK (preferred_language IN ('en', 'es')),
  communication_preferences JSONB DEFAULT '{"sms": true, "email": true, "voice": false}'::jsonb,
  status TEXT DEFAULT 'prospect' CHECK (status IN ('prospect', 'lead', 'applicant', 'approved', 'active_tenant', 'notice_given', 'moving_out', 'former_tenant', 'denied', 'evicted', 'archived')),
  credit_score INTEGER,
  background_check_status TEXT CHECK (background_check_status IN ('pending', 'approved', 'denied', 'expired')),
  background_check_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Leases
CREATE TABLE hr.leases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  unit_id UUID NOT NULL REFERENCES hr.units(id) ON DELETE CASCADE,
  primary_tenant_id UUID NOT NULL REFERENCES hr.tenants(id) ON DELETE CASCADE,
  lease_type TEXT DEFAULT 'fixed_term' CHECK (lease_type IN ('fixed_term', 'month_to_month', 'week_to_week')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'signed', 'active', 'expiring', 'renewed', 'expired', 'terminated', 'breached', 'cancelled', 'voided')),
  start_date DATE NOT NULL,
  end_date DATE,
  rent_amount_cents BIGINT NOT NULL,
  security_deposit_cents BIGINT NOT NULL,
  pet_deposit_cents BIGINT DEFAULT 0,
  late_fee_cents BIGINT DEFAULT 0,
  grace_period_days INTEGER DEFAULT 5,
  rent_due_day INTEGER DEFAULT 1 CHECK (rent_due_day BETWEEN 1 AND 31),
  utilities_included TEXT[],
  pet_policy JSONB DEFAULT '{}'::jsonb,
  parking_spaces INTEGER DEFAULT 0,
  special_terms TEXT,
  lease_document_id UUID,
  signed_date DATE,
  signed_by_tenant_at TIMESTAMPTZ,
  signed_by_landlord_at TIMESTAMPTZ,
  renewal_notice_date DATE,
  move_out_notice_date DATE,
  actual_move_out_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Technicians
CREATE TABLE hr.technicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID REFERENCES platform.users(id) ON DELETE SET NULL,
  employee_id TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email CITEXT,
  specialties TEXT[],
  hourly_rate_cents BIGINT,
  is_vendor BOOLEAN DEFAULT false,
  company_name TEXT,
  license_number TEXT,
  insurance_expiry DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Work Orders
CREATE TABLE hr.work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  work_order_number TEXT NOT NULL,
  property_id UUID NOT NULL REFERENCES hr.properties(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES hr.units(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES hr.tenants(id) ON DELETE SET NULL,
  lease_id UUID REFERENCES hr.leases(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('plumbing', 'electrical', 'hvac', 'appliances', 'pest_control', 'cleaning', 'painting', 'flooring', 'windows', 'doors', 'general', 'emergency')),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent', 'emergency')),
  status TEXT NOT NULL CHECK (status IN ('submitted', 'triaged', 'rejected', 'escalated', 'emergency', 'assigned', 'scheduled', 'cancelled', 'rescheduled', 'in_progress', 'on_hold', 'needs_parts', 'reassigned', 'completed', 'verified', 'tenant_approved', 'follow_up_needed', 'reopened', 'closed')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location_details TEXT,
  tenant_phone TEXT,
  tenant_access_notes TEXT,
  estimated_cost_cents BIGINT,
  actual_cost_cents BIGINT,
  labor_hours DECIMAL(5,2),
  parts_cost_cents BIGINT,
  vendor_invoice_number TEXT,
  warranty_expires_at DATE,
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  technician_id UUID REFERENCES hr.technicians(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES platform.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES platform.users(id) ON DELETE SET NULL,
  tenant_satisfaction_rating INTEGER CHECK (tenant_satisfaction_rating BETWEEN 1 AND 5),
  tenant_feedback TEXT,
  internal_notes TEXT,
  follow_up_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, work_order_number)
);

-- Evidence
CREATE TABLE hr.evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  work_order_id UUID NOT NULL REFERENCES hr.work_orders(id) ON DELETE CASCADE,
  file_asset_id UUID NOT NULL,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('before_photo', 'after_photo', 'progress_photo', 'invoice', 'receipt', 'warranty', 'permit', 'tenant_damage', 'compliance_photo', 'other')),
  description TEXT,
  taken_by UUID REFERENCES platform.users(id) ON DELETE SET NULL,
  gps_coordinates GEOGRAPHY(POINT, 4326),
  timestamp_verified BOOLEAN DEFAULT false,
  legal_hold BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Visit Attempts
CREATE TABLE hr.visit_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  work_order_id UUID NOT NULL REFERENCES hr.work_orders(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES hr.technicians(id),
  attempt_date TIMESTAMPTZ NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('completed', 'no_access', 'tenant_unavailable', 'emergency_only', 'rescheduled', 'cancelled')),
  access_method TEXT CHECK (access_method IN ('tenant_present', 'key', 'emergency_entry', 'maintenance_key')),
  tenant_notification_sent BOOLEAN DEFAULT false,
  tenant_notification_method TEXT CHECK (tenant_notification_method IN ('sms', 'email', 'phone', 'door_notice', 'certified_mail')),
  gps_coordinates GEOGRAPHY(POINT, 4326),
  arrival_time TIMESTAMPTZ,
  departure_time TIMESTAMPTZ,
  notes TEXT,
  photos TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Charges
CREATE TABLE hr.charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  lease_id UUID NOT NULL REFERENCES hr.leases(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES hr.tenants(id) ON DELETE CASCADE,
  charge_type TEXT NOT NULL CHECK (charge_type IN ('rent', 'late_fee', 'pet_fee', 'utility', 'maintenance', 'damage', 'other')),
  amount_cents BIGINT NOT NULL,
  description TEXT NOT NULL,
  due_date DATE NOT NULL,
  period_start DATE,
  period_end DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'partial', 'overdue', 'waived', 'disputed')),
  waived_by UUID REFERENCES platform.users(id),
  waived_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payments
CREATE TABLE hr.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES hr.tenants(id) ON DELETE CASCADE,
  amount_cents BIGINT NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('ach', 'credit_card', 'debit_card', 'cash', 'check', 'money_order', 'venmo', 'zelle', 'other')),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('initiated', 'pending', 'processing', 'authorized', 'completed', 'settled', 'failed', 'declined', 'cancelled', 'expired', 'voided', 'refunded', 'disputed', 'chargeback')),
  external_payment_id TEXT,
  payment_date DATE NOT NULL,
  processed_at TIMESTAMPTZ,
  settlement_date DATE,
  reference_number TEXT,
  fee_cents BIGINT DEFAULT 0,
  notes TEXT,
  receipt_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payment Allocations
CREATE TABLE hr.payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES hr.payments(id) ON DELETE CASCADE,
  charge_id UUID NOT NULL REFERENCES hr.charges(id) ON DELETE CASCADE,
  amount_cents BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(payment_id, charge_id)
);

-- Notice Templates
CREATE TABLE hr.notice_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  notice_type TEXT NOT NULL CHECK (notice_type IN ('pay_or_quit', 'cure_or_quit', 'unconditional_quit', 'lease_violation', 'non_renewal', 'rent_increase', 'entry_notice', 'other')),
  body TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Legal Notices
CREATE TABLE hr.legal_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  template_id UUID NOT NULL REFERENCES hr.notice_templates(id),
  tenant_id UUID NOT NULL REFERENCES hr.tenants(id),
  lease_id UUID REFERENCES hr.leases(id) ON DELETE SET NULL,
  property_id UUID NOT NULL REFERENCES hr.properties(id),
  status TEXT NOT NULL CHECK (status IN ('draft', 'issued', 'served', 'acknowledged', 'expired', 'complied', 'filed')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  legal_deadline DATE,
  amount_owed_cents BIGINT,
  violation_details TEXT,
  cure_period_days INTEGER,
  document_id UUID,
  issued_at TIMESTAMPTZ,
  served_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Service Attempts
CREATE TABLE hr.service_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  notice_id UUID NOT NULL REFERENCES hr.legal_notices(id),
  server_name TEXT NOT NULL,
  attempt_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  method TEXT NOT NULL CHECK (method IN ('personal', 'substitute', 'posting', 'certified_mail', 'email', 'other')),
  result TEXT NOT NULL CHECK (result IN ('served', 'refused', 'not_home', 'invalid_address', 'other')),
  evidence_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit Events with Hash Chain
CREATE TABLE hr.events (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  actor_user_id UUID,
  actor_type TEXT CHECK (actor_type IN ('user', 'system', 'api', 'webhook')),
  action TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  legal_significance BOOLEAN DEFAULT false,
  prev_hash BYTEA,
  current_hash BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Daily Audit Snapshots
CREATE TABLE hr.audit_snapshots (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL,
  snapshot_date DATE NOT NULL,
  event_count BIGINT NOT NULL,
  first_event_id BIGINT NOT NULL,
  last_event_id BIGINT NOT NULL,
  chain_hash BYTEA NOT NULL,
  signature BYTEA,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, snapshot_date)
);

-- ========== ROW LEVEL SECURITY ==========

-- Enable RLS on all multi-tenant tables
ALTER TABLE hr.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.visit_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.notice_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.legal_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.service_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.audit_snapshots ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY hr_org_isolation ON hr.properties
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY hr_org_isolation ON hr.buildings
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY hr_org_isolation ON hr.units
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY hr_org_isolation ON hr.tenants
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY hr_org_isolation ON hr.leases
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY hr_org_isolation ON hr.technicians
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY hr_org_isolation ON hr.work_orders
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY hr_org_isolation ON hr.evidence
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY hr_org_isolation ON hr.visit_attempts
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY hr_org_isolation ON hr.charges
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY hr_org_isolation ON hr.payments
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY hr_org_isolation ON hr.notice_templates
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY hr_org_isolation ON hr.legal_notices
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY hr_org_isolation ON hr.service_attempts
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY hr_org_isolation ON hr.events
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY hr_org_isolation ON hr.audit_snapshots
  USING (organization_id = current_setting('app.current_org', true)::uuid);

-- ========== INDEXES ==========

-- Core business indexes
CREATE INDEX idx_units_property_status ON hr.units(property_id, status);
CREATE INDEX idx_units_availability ON hr.units(availability_date, status) WHERE status = 'available';
CREATE INDEX idx_work_orders_status_priority ON hr.work_orders(organization_id, status, priority, created_at);
CREATE INDEX idx_work_orders_technician ON hr.work_orders(technician_id, status);
CREATE INDEX idx_work_orders_property_unit ON hr.work_orders(property_id, unit_id, created_at);
CREATE INDEX idx_leases_unit_active ON hr.leases(unit_id, status) WHERE status IN ('active', 'expiring');
CREATE INDEX idx_charges_due_date ON hr.charges(organization_id, due_date, status) WHERE status IN ('pending', 'overdue');
CREATE INDEX idx_payments_tenant_date ON hr.payments(tenant_id, payment_date);
CREATE INDEX idx_evidence_work_order ON hr.evidence(organization_id, work_order_id, created_at DESC);
CREATE INDEX idx_events_entity ON hr.events(entity_type, entity_id, created_at);
CREATE INDEX idx_events_timeline ON hr.events(organization_id, created_at);
CREATE INDEX idx_legal_notices_tenant ON hr.legal_notices(tenant_id, status, created_at);
CREATE INDEX idx_service_attempts_notice ON hr.service_attempts(notice_id, attempt_time);

-- Geographic indexes
CREATE INDEX idx_properties_location ON hr.properties USING GIST(location);
CREATE INDEX idx_visit_attempts_location ON hr.visit_attempts USING GIST(gps_coordinates);
CREATE INDEX idx_evidence_location ON hr.evidence USING GIST(gps_coordinates);

-- Search indexes
CREATE INDEX idx_tenants_search ON hr.tenants USING GIN(to_tsvector('english', first_name || ' ' || last_name || ' ' || COALESCE(email, '') || ' ' || COALESCE(phone, '')));
CREATE INDEX idx_work_orders_search ON hr.work_orders USING GIN(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- ========== FUNCTIONS ==========

-- Work order number generation
CREATE OR REPLACE FUNCTION hr.generate_work_order_number(org_id UUID)
RETURNS TEXT AS $$
DECLARE
  year_part TEXT;
  sequence_part TEXT;
  next_seq INTEGER;
BEGIN
  year_part := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(work_order_number FROM 'WO-\d{4}-(\d+)') AS INTEGER)), 0) + 1
  INTO next_seq
  FROM hr.work_orders 
  WHERE organization_id = org_id 
    AND work_order_number LIKE 'WO-' || year_part || '-%';
  
  sequence_part := LPAD(next_seq::TEXT, 3, '0');
  
  RETURN 'WO-' || year_part || '-' || sequence_part;
END;
$$ LANGUAGE plpgsql;

-- Hash chain audit trigger
CREATE OR REPLACE FUNCTION hr.update_audit_hash()
RETURNS TRIGGER AS $$
DECLARE
  prev_record RECORD;
  hash_input TEXT;
BEGIN
  -- Get the previous event for this organization
  SELECT current_hash INTO prev_record
  FROM hr.events 
  WHERE organization_id = NEW.organization_id
    AND id < NEW.id
  ORDER BY id DESC
  LIMIT 1;
  
  NEW.prev_hash := COALESCE(prev_record.current_hash, '\x00'::BYTEA);
  
  -- Create hash input from event data
  hash_input := NEW.id::TEXT || NEW.organization_id::TEXT || NEW.event_type || 
                NEW.entity_type || NEW.entity_id::TEXT || NEW.new_values::TEXT ||
                COALESCE(NEW.prev_hash::TEXT, '');
  
  NEW.current_hash := sha256(hash_input::BYTEA);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_hash_trigger
  BEFORE INSERT ON hr.events
  FOR EACH ROW EXECUTE FUNCTION hr.update_audit_hash();