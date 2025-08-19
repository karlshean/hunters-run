-- Migration 004: Add foreign key constraints
-- Adds referential integrity between tables

BEGIN;

-- Units -> Properties foreign key
ALTER TABLE hr.units 
ADD CONSTRAINT fk_units_property_id 
FOREIGN KEY (property_id) REFERENCES hr.properties(id) ON DELETE CASCADE;

-- Tenants -> Units foreign key (nullable)
ALTER TABLE hr.tenants 
ADD CONSTRAINT fk_tenants_unit_id 
FOREIGN KEY (unit_id) REFERENCES hr.units(id) ON DELETE SET NULL;

-- Work Orders -> Units foreign key
ALTER TABLE hr.work_orders 
ADD CONSTRAINT fk_work_orders_unit_id 
FOREIGN KEY (unit_id) REFERENCES hr.units(id) ON DELETE CASCADE;

-- Work Orders -> Tenants foreign key (nullable)
ALTER TABLE hr.work_orders 
ADD CONSTRAINT fk_work_orders_tenant_id 
FOREIGN KEY (tenant_id) REFERENCES hr.tenants(id) ON DELETE SET NULL;

-- Work Orders -> Technicians foreign key (nullable)
ALTER TABLE hr.work_orders 
ADD CONSTRAINT fk_work_orders_assigned_tech_id 
FOREIGN KEY (assigned_tech_id) REFERENCES hr.technicians(id) ON DELETE SET NULL;

-- Evidence -> Work Orders foreign key
ALTER TABLE hr.evidence 
ADD CONSTRAINT fk_evidence_work_order_id 
FOREIGN KEY (work_order_id) REFERENCES hr.work_orders(id) ON DELETE CASCADE;

-- Add indexes for performance
CREATE INDEX idx_units_property_id ON hr.units(property_id);
CREATE INDEX idx_units_organization_id ON hr.units(organization_id);

CREATE INDEX idx_tenants_unit_id ON hr.tenants(unit_id);
CREATE INDEX idx_tenants_organization_id ON hr.tenants(organization_id);

CREATE INDEX idx_work_orders_unit_id ON hr.work_orders(unit_id);
CREATE INDEX idx_work_orders_tenant_id ON hr.work_orders(tenant_id);
CREATE INDEX idx_work_orders_assigned_tech_id ON hr.work_orders(assigned_tech_id);
CREATE INDEX idx_work_orders_organization_id ON hr.work_orders(organization_id);
CREATE INDEX idx_work_orders_status ON hr.work_orders(status);
CREATE INDEX idx_work_orders_priority ON hr.work_orders(priority);

CREATE INDEX idx_evidence_work_order_id ON hr.evidence(work_order_id);
CREATE INDEX idx_evidence_organization_id ON hr.evidence(organization_id);

CREATE INDEX idx_events_organization_id ON hr.events(organization_id);
CREATE INDEX idx_events_entity_type_id ON hr.events(entity_type, entity_id);
CREATE INDEX idx_events_created_at ON hr.events(created_at);

CREATE INDEX idx_properties_organization_id ON hr.properties(organization_id);
CREATE INDEX idx_technicians_organization_id ON hr.technicians(organization_id);

COMMIT;