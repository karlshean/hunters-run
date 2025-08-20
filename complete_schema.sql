-- =========================================================
-- COMPLETE HUNTERS RUN PROPERTY MANAGEMENT SCHEMA
-- Unified PostgreSQL with RLS for enterprise property management
-- Covers: Properties, Units, Leases, Tenants, Maintenance, Financials, Legal
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS postgis; -- For geographic features

-- Session context for RLS
-- SET LOCAL app.current_org = 'uuid';
-- SET LOCAL app.current_user = 'uuid';

-- ========== PLATFORM SCHEMA ==========
CREATE SCHEMA IF NOT EXISTS platform;

CREATE TABLE platform.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT UNIQUE NOT NULL,
  email_verified_at TIMESTAMPTZ,
  phone TEXT,
  full_name TEXT,
  preferred_language TEXT DEFAULT 'en' CHECK (preferred_language IN ('en', 'es')),
  is_minor BOOLEAN DEFAULT false,
  parental_consent_at TIMESTAMPTZ,
  device_fingerprint TEXT, -- For child account binding
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE platform.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('property_management', 'parish', 'household', 'fleet', 'school')),
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE platform.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL, -- e.g., 'hr.admin', 'hr.tenant', 'hr.technician'
  name TEXT NOT NULL,
  description TEXT,
  product_key TEXT NOT NULL -- 'hunters_run', 'server_scheduling', etc.
);

CREATE TABLE platform.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL, -- e.g., 'hr.work_orders.read', 'hr.evidence.write'
  description TEXT NOT NULL,
  product_key TEXT NOT NULL
);

CREATE TABLE platform.role_permissions (
  role_id UUID REFERENCES platform.roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES platform.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

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

CREATE TABLE platform.file_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  product_key TEXT NOT NULL,
  owner_user_id UUID REFERENCES platform.users(id) ON DELETE SET NULL,
  storage_key TEXT NOT NULL, -- S3 object key
  original_filename TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========== HUNTERS RUN SCHEMA ==========
CREATE SCHEMA IF NOT EXISTS hr;

-- Property Management Entities
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
  amenities TEXT[], -- ['pool', 'gym', 'parking', 'laundry']
  description TEXT,
  location GEOGRAPHY(POINT, 4326), -- PostGIS for mapping
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'inactive', 'archived')),
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE hr.buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES hr.properties(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  building_name TEXT NOT NULL, -- 'A', 'B', 'Main Building'
  address TEXT, -- If different from property
  floors INTEGER DEFAULT 1,
  units_per_floor INTEGER,
  amenities TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE hr.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES hr.properties(id) ON DELETE CASCADE,
  building_id UUID REFERENCES hr.buildings(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL,
  unit_number TEXT NOT NULL, -- '1A', '201', 'Unit 5'
  floor INTEGER,
  bedrooms INTEGER DEFAULT 0,
  bathrooms DECIMAL(3,1) DEFAULT 0,
  square_footage INTEGER,
  market_rent_cents BIGINT, -- Current market rate
  base_rent_cents BIGINT, -- Base rent amount
  deposit_cents BIGINT, -- Security deposit amount
  pet_deposit_cents BIGINT DEFAULT 0,
  amenities TEXT[], -- ['dishwasher', 'balcony', 'washer_dryer']
  description TEXT,
  move_in_ready BOOLEAN DEFAULT false,
  last_renovated DATE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'available', 'occupied', 'notice_given', 'vacating', 'make_ready', 'maintenance', 'off_market', 'inactive')),
  availability_date DATE,
  photos TEXT[], -- Array of file_asset IDs
  virtual_tour_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(property_id, unit_number)
);

-- Tenant Management
CREATE TABLE hr.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID REFERENCES platform.users(id) ON DELETE SET NULL, -- Link to platform user
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email CITEXT,
  phone TEXT,
  date_of_birth DATE,
  ssn_last_four TEXT, -- Last 4 digits only
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

-- Lease Management
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
  utilities_included TEXT[], -- ['water', 'electric', 'gas', 'internet']
  pet_policy JSONB DEFAULT '{}'::jsonb,
  parking_spaces INTEGER DEFAULT 0,
  special_terms TEXT,
  lease_document_id UUID, -- Reference to signed lease file
  signed_date DATE,
  signed_by_tenant_at TIMESTAMPTZ,
  signed_by_landlord_at TIMESTAMPTZ,
  renewal_notice_date DATE,
  move_out_notice_date DATE,
  actual_move_out_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Additional tenants on lease (roommates, spouses)
CREATE TABLE hr.lease_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id UUID NOT NULL REFERENCES hr.leases(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES hr.tenants(id) ON DELETE CASCADE,
  relationship TEXT CHECK (relationship IN ('primary', 'spouse', 'roommate', 'dependent', 'guarantor')),
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lease_id, tenant_id)
);

-- Maintenance & Work Orders
CREATE TABLE hr.technicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID REFERENCES platform.users(id) ON DELETE SET NULL,
  employee_id TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email CITEXT,
  specialties TEXT[], -- ['plumbing', 'electrical', 'hvac', 'general']
  hourly_rate_cents BIGINT,
  is_vendor BOOLEAN DEFAULT false,
  company_name TEXT,
  license_number TEXT,
  insurance_expiry DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE hr.work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  work_order_number TEXT NOT NULL, -- Auto-generated: WO-2025-001
  property_id UUID NOT NULL REFERENCES hr.properties(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES hr.units(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES hr.tenants(id) ON DELETE SET NULL,
  lease_id UUID REFERENCES hr.leases(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('plumbing', 'electrical', 'hvac', 'appliances', 'pest_control', 'cleaning', 'painting', 'flooring', 'windows', 'doors', 'general', 'emergency')),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent', 'emergency')),
  status TEXT NOT NULL CHECK (status IN ('submitted', 'triaged', 'rejected', 'escalated', 'emergency', 'assigned', 'scheduled', 'cancelled', 'rescheduled', 'in_progress', 'on_hold', 'needs_parts', 'reassigned', 'completed', 'verified', 'tenant_approved', 'follow_up_needed', 'reopened', 'closed')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location_details TEXT, -- "Kitchen sink under cabinet"
  tenant_phone TEXT, -- Contact for this specific request
  tenant_access_notes TEXT, -- "Call 30 min before arrival"
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
  created_by UUID REFERENCES platform.users(id) ON DELETE SET NULL, -- System user for tenant submissions
  tenant_satisfaction_rating INTEGER CHECK (tenant_satisfaction_rating BETWEEN 1 AND 5),
  tenant_feedback TEXT,
  internal_notes TEXT,
  follow_up_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, work_order_number)
);

-- Evidence & Documentation
CREATE TABLE hr.evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  work_order_id UUID NOT NULL REFERENCES hr.work_orders(id) ON DELETE CASCADE,
  file_asset_id UUID NOT NULL, -- platform.file_assets
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('before_photo', 'after_photo', 'progress_photo', 'invoice', 'receipt', 'warranty', 'permit', 'tenant_damage', 'compliance_photo', 'other')),
  description TEXT,
  taken_by UUID REFERENCES platform.users(id) ON DELETE SET NULL,
  gps_coordinates GEOGRAPHY(POINT, 4326),
  timestamp_verified BOOLEAN DEFAULT false,
  legal_hold BOOLEAN DEFAULT false, -- Preserve for legal proceedings
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Visit attempts for legal documentation
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
  photos TEXT[], -- Evidence file IDs
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Financial Management
CREATE TABLE hr.charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  lease_id UUID NOT NULL REFERENCES hr.leases(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES hr.tenants(id) ON DELETE CASCADE,
  charge_type TEXT NOT NULL CHECK (charge_type IN ('rent', 'late_fee', 'pet_fee', 'utility', 'maintenance', 'damage', 'other')),
  amount_cents BIGINT NOT NULL,
  description TEXT NOT NULL,
  due_date DATE NOT NULL,
  period_start DATE, -- For recurring charges like rent
  period_end DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'partial', 'overdue', 'waived', 'disputed')),
  waived_by UUID REFERENCES platform.users(id),
  waived_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE hr.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES hr.tenants(id) ON DELETE CASCADE,
  amount_cents BIGINT NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('ach', 'credit_card', 'debit_card', 'cash', 'check', 'money_order', 'venmo', 'zelle', 'other')),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('initiated', 'pending', 'processing', 'authorized', 'completed', 'settled', 'failed', 'declined', 'cancelled', 'expired', 'voided', 'refunded', 'disputed', 'chargeback')),
  external_payment_id TEXT, -- Stripe payment intent ID
  payment_date DATE NOT NULL,
  processed_at TIMESTAMPTZ,
  settlement_date DATE,
  reference_number TEXT, -- Check number, transaction ID
  fee_cents BIGINT DEFAULT 0, -- Processing fee
  notes TEXT,
  receipt_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Link payments to charges (one payment can cover multiple charges)
CREATE TABLE hr.payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES hr.payments(id) ON DELETE CASCADE,
  charge_id UUID NOT NULL REFERENCES hr.charges(id) ON DELETE CASCADE,
  amount_cents BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(payment_id, charge_id)
);

-- Utility billing
CREATE TABLE hr.utility_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  property_id UUID NOT NULL REFERENCES hr.properties(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES hr.units(id) ON DELETE CASCADE, -- NULL for property-wide utilities
  utility_type TEXT NOT NULL CHECK (utility_type IN ('water', 'sewer', 'electric', 'gas', 'trash', 'internet', 'cable')),
  account_number TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  billing_method TEXT NOT NULL CHECK (billing_method IN ('flat_rate', 'actual_usage', 'rubs', 'submetered')),
  flat_rate_cents BIGINT, -- For flat rate billing
  rubs_formula JSONB, -- Formula for RUBS calculation
  meter_number TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE hr.utility_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  utility_account_id UUID NOT NULL REFERENCES hr.utility_accounts(id) ON DELETE CASCADE,
  reading_date DATE NOT NULL,
  reading_value DECIMAL(10,2) NOT NULL,
  reading_type TEXT CHECK (reading_type IN ('actual', 'estimated', 'final')),
  read_by UUID REFERENCES platform.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Legal & Compliance
CREATE TABLE hr.legal_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES hr.tenants(id) ON DELETE CASCADE,
  lease_id UUID REFERENCES hr.leases(id) ON DELETE SET NULL,
  notice_type TEXT NOT NULL CHECK (notice_type IN ('pay_or_quit', 'cure_or_quit', 'unconditional_quit', 'lease_violation', 'non_renewal', 'rent_increase', 'entry_notice', 'other')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'served', 'acknowledged', 'expired', 'complied', 'ignored')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  legal_deadline DATE,
  amount_owed_cents BIGINT, -- For pay or quit notices
  violation_details TEXT,
  cure_period_days INTEGER,
  document_id UUID, -- Generated notice document
  served_date DATE,
  service_method TEXT CHECK (service_method IN ('personal', 'substitute', 'posting', 'certified_mail', 'email', 'other')),
  served_by UUID REFERENCES platform.users(id),
  proof_of_service_id UUID, -- Evidence file
  tenant_response TEXT,
  attorney_involved BOOLEAN DEFAULT false,
  court_case_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vendor Management
CREATE TABLE hr.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email CITEXT,
  address TEXT,
  license_number TEXT,
  insurance_certificate_id UUID, -- File asset
  insurance_expiry DATE,
  tax_id TEXT,
  specialties TEXT[],
  service_areas TEXT[], -- Geographic areas they serve
  hourly_rate_cents BIGINT,
  minimum_charge_cents BIGINT,
  emergency_available BOOLEAN DEFAULT false,
  payment_terms TEXT, -- "Net 30", "Due on receipt"
  performance_rating DECIMAL(3,2), -- Average rating 1.00 - 5.00
  status TEXT DEFAULT 'active' CHECK (status IN ('prospect', 'onboarding', 'pending', 'declined', 'approved', 'active', 'preferred', 'suspended', 'probation', 'blacklisted', 'terminated', 'archived')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vendor work assignments
CREATE TABLE hr.vendor_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES hr.work_orders(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES hr.vendors(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  decline_reason TEXT,
  estimated_cost_cents BIGINT,
  quoted_at TIMESTAMPTZ,
  po_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inspections
CREATE TABLE hr.inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  property_id UUID NOT NULL REFERENCES hr.properties(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES hr.units(id) ON DELETE CASCADE,
  inspection_type TEXT NOT NULL CHECK (inspection_type IN ('move_in', 'move_out', 'annual', 'maintenance', 'safety', 'government', 'insurance')),
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'rescheduled')),
  scheduled_date DATE NOT NULL,
  completed_date DATE,
  inspector_id UUID REFERENCES platform.users(id),
  tenant_present BOOLEAN,
  checklist_template_id UUID,
  inspection_results JSONB DEFAULT '{}'::jsonb,
  overall_condition TEXT CHECK (overall_condition IN ('excellent', 'good', 'fair', 'poor')),
  issues_found TEXT[],
  photos TEXT[], -- Evidence file IDs
  report_generated BOOLEAN DEFAULT false,
  report_file_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Marketing & Leasing
CREATE TABLE hr.listing_syndications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  unit_id UUID NOT NULL REFERENCES hr.units(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('zillow', 'apartments_com', 'craigslist', 'facebook', 'company_website')),
  external_listing_id TEXT,
  listing_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'expired', 'removed')),
  posted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  lead_count INTEGER DEFAULT 0,
  listing_data JSONB DEFAULT '{}'::jsonb, -- Platform-specific data
  last_synced_at TIMESTAMPTZ,
  sync_errors TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE hr.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  unit_id UUID REFERENCES hr.units(id) ON DELETE SET NULL,
  source TEXT NOT NULL CHECK (source IN ('website', 'zillow', 'apartments_com', 'referral', 'walk_in', 'phone', 'facebook', 'craigslist')),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email CITEXT,
  phone TEXT,
  move_in_date DATE,
  budget_min_cents BIGINT,
  budget_max_cents BIGINT,
  pets BOOLEAN,
  notes TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'showing_scheduled', 'application_submitted', 'approved', 'denied', 'lease_signed', 'lost', 'unqualified')),
  assigned_to UUID REFERENCES platform.users(id),
  lead_score INTEGER, -- 1-100 qualification score
  last_contact_date DATE,
  next_follow_up DATE,
  conversion_date DATE,
  lost_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit Events (append-only with hash chaining)
CREATE TABLE hr.audit_events (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL,
  event_type TEXT NOT NULL, -- 'work_order.created', 'payment.completed'
  entity_type TEXT NOT NULL, -- 'work_order', 'payment', 'lease'
  entity_id UUID NOT NULL,
  actor_user_id UUID,
  actor_type TEXT CHECK (actor_type IN ('user', 'system', 'api', 'webhook')),
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'state_change'
  old_values JSONB,
  new_values JSONB NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  legal_significance BOOLEAN DEFAULT false, -- Important for court proceedings
  prev_hash BYTEA,
  current_hash BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Daily audit snapshots
CREATE TABLE hr.audit_snapshots (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL,
  snapshot_date DATE NOT NULL,
  event_count BIGINT NOT NULL,
  first_event_id BIGINT NOT NULL,
  last_event_id BIGINT NOT NULL,
  chain_hash BYTEA NOT NULL,
  signature BYTEA, -- Cryptographic signature
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, snapshot_date)
);

-- ========== ROW LEVEL SECURITY POLICIES ==========

-- Enable RLS on all tenant tables
ALTER TABLE hr.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.lease_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.visit_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.utility_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.utility_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.legal_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.vendor_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.listing_syndications ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.audit_snapshots ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for organization isolation
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

CREATE POLICY hr_org_isolation ON hr.utility_accounts
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY hr_org_isolation ON hr.legal_notices
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY hr_org_isolation ON hr.vendors
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY hr_org_isolation ON hr.inspections
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY hr_org_isolation ON hr.listing_syndications
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY hr_org_isolation ON hr.leads
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY hr_org_isolation ON hr.audit_events
  USING (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY hr_org_isolation ON hr.audit_snapshots
  USING (organization_id = current_setting('app.current_org', true)::uuid);

-- ========== INDEXES FOR PERFORMANCE ==========

-- Core business queries
CREATE INDEX idx_units_property_status ON hr.units(property_id, status);
CREATE INDEX idx_units_availability ON hr.units(availability_date, status) WHERE status = 'available';
CREATE INDEX idx_work_orders_status_priority ON hr.work_orders(status, priority, created_at);
CREATE INDEX idx_work_orders_technician ON hr.work_orders(technician_id, status);
CREATE INDEX idx_work_orders_property_unit ON hr.work_orders(property_id, unit_id, created_at);
CREATE INDEX idx_leases_unit_active ON hr.leases(unit_id, status) WHERE status IN ('active', 'expiring');
CREATE INDEX idx_charges_due_date ON hr.charges(due_date, status) WHERE status IN ('pending', 'overdue');
CREATE INDEX idx_payments_tenant_date ON hr.payments(tenant_id, payment_date);
CREATE INDEX idx_audit_events_entity ON hr.audit_events(entity_type, entity_id, created_at);
CREATE INDEX idx_audit_events_timeline ON hr.audit_events(organization_id, created_at);

-- Geographic queries
CREATE INDEX idx_properties_location ON hr.properties USING GIST(location);
CREATE INDEX idx_visit_attempts_location ON hr.visit_attempts USING GIST(gps_coordinates);

-- Search and lookup
CREATE INDEX idx_tenants_search ON hr.tenants USING GIN(to_tsvector('english', first_name || ' ' || last_name || ' ' || COALESCE(email, '') || ' ' || COALESCE(phone, '')));
CREATE INDEX idx_work_orders_search ON hr.work_orders USING GIN(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- ========== FUNCTIONS FOR BUSINESS LOGIC ==========

-- Generate work order numbers
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

-- Calculate rent charges
CREATE OR REPLACE FUNCTION hr.calculate_monthly_rent_charge(lease_id UUID, charge_date DATE)
RETURNS BIGINT AS $$
DECLARE
  lease_record hr.leases%ROWTYPE;
  monthly_amount BIGINT;
BEGIN
  SELECT * INTO lease_record FROM hr.leases WHERE id = lease_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lease not found: %', lease_id;
  END IF;
  
  IF lease_record.status != 'active' THEN
    RAISE EXCEPTION 'Lease is not active: %', lease_record.status;
  END IF;
  
  monthly_amount := lease_record.rent_amount_cents;
  
  -- Pro-rate for partial months if needed
  -- (Implementation would check if charge_date is mid-month)
  
  RETURN monthly_amount;
END;
$$ LANGUAGE plpgsql;

-- Hash chain for audit integrity
CREATE OR REPLACE FUNCTION hr.update_audit_hash()
RETURNS TRIGGER AS $$
DECLARE
  prev_record RECORD;
  hash_input TEXT;
BEGIN
  -- Get the previous event for this organization
  SELECT current_hash INTO prev_record
  FROM hr.audit_events 
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
  BEFORE INSERT ON hr.audit_events
  FOR EACH ROW EXECUTE FUNCTION hr.update_audit_hash();

-- ========== INITIAL DATA ==========

-- Insert default roles for Hunters Run
INSERT INTO platform.roles (key, name, description, product_key) VALUES
('hr.admin', 'Property Manager', 'Full administrative access to all property management functions', 'hunters_run'),
('hr.manager', 'Assistant Manager', 'Limited management access, cannot modify financial settings', 'hunters_run'),
('hr.technician', 'Maintenance Technician', 'Can view and update assigned work orders', 'hunters_run'),
('hr.tenant', 'Tenant', 'Can submit maintenance requests and view own account', 'hunters_run'),
('hr.leasing', 'Leasing Agent', 'Can manage leads, applications, and leases', 'hunters_run'),
('hr.accounting', 'Accounting', 'Read-only access to financial reports', 'hunters_run')
ON CONFLICT (key) DO NOTHING;

-- Insert permissions
INSERT INTO platform.permissions (key, description, product_key) VALUES
-- Work Orders
('hr.work_orders.read', 'View work orders', 'hunters_run'),
('hr.work_orders.write', 'Create and modify work orders', 'hunters_run'),
('hr.work_orders.assign', 'Assign work orders to technicians', 'hunters_run'),
('hr.work_orders.close', 'Mark work orders as completed', 'hunters_run'),
-- Properties & Units
('hr.properties.read', 'View property information', 'hunters_run'),
('hr.properties.write', 'Modify property information', 'hunters_run'),
('hr.units.read', 'View unit information', 'hunters_run'),
('hr.units.write', 'Modify unit information and availability', 'hunters_run'),
-- Tenants & Leases
('hr.tenants.read', 'View tenant information', 'hunters_run'),
('hr.tenants.write', 'Modify tenant information', 'hunters_run'),
('hr.leases.read', 'View lease agreements', 'hunters_run'),
('hr.leases.write', 'Create and modify lease agreements', 'hunters_run'),
-- Financial
('hr.charges.read', 'View charges and billing', 'hunters_run'),
('hr.charges.write', 'Create and modify charges', 'hunters_run'),
('hr.payments.read', 'View payment information', 'hunters_run'),
('hr.payments.process', 'Process payments and refunds', 'hunters_run'),
-- Legal & Compliance
('hr.legal.read', 'View legal notices and compliance', 'hunters_run'),
('hr.legal.write', 'Create legal notices and manage compliance', 'hunters_run'),
-- Evidence & Audit
('hr.evidence.read', 'View evidence and documentation', 'hunters_run'),
('hr.evidence.write', 'Upload and manage evidence', 'hunters_run'),
('hr.audit.read', 'View audit logs and reports', 'hunters_run')
ON CONFLICT (key) DO NOTHING;