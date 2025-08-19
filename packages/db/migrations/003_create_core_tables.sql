-- Migration 003: Create core tables
-- Creates all main business tables with organization_id

BEGIN;

-- Properties table
CREATE TABLE hr.properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Units table
CREATE TABLE hr.units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    property_id UUID NOT NULL,
    unit_number VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenants table
CREATE TABLE hr.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    unit_id UUID,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Technicians table
CREATE TABLE hr.technicians (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Work orders table
CREATE TABLE hr.work_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    unit_id UUID NOT NULL,
    tenant_id UUID,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority hr.priority NOT NULL DEFAULT 'normal',
    status hr.status NOT NULL DEFAULT 'new',
    assigned_tech_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evidence table
CREATE TABLE hr.evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    work_order_id UUID NOT NULL,
    file_key VARCHAR(255) NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    mime VARCHAR(100) NOT NULL,
    taken_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events table (audit log with hash chain)
CREATE TABLE hr.events (
    id BIGSERIAL PRIMARY KEY,
    organization_id UUID NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    new_values JSONB,
    prev_hash BYTEA,
    current_hash BYTEA,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMIT;