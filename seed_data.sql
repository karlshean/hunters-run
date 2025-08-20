-- migrations/002_seed_data.sql
-- Initial seed data for platform setup

-- Insert default roles for Hunters Run
INSERT INTO platform.roles (key, name, description, product_key) VALUES
('hr.admin', 'Property Manager', 'Full administrative access to all property management functions', 'hunters_run'),
('hr.manager', 'Assistant Manager', 'Limited management access, cannot modify financial settings', 'hunters_run'),
('hr.technician', 'Maintenance Technician', 'Can view and update assigned work orders', 'hunters_run'),
('hr.tenant', 'Tenant', 'Can submit maintenance requests and view own account', 'hunters_run'),
('hr.leasing', 'Leasing Agent', 'Can manage leads, applications, and leases', 'hunters_run'),
('hr.accounting', 'Accounting', 'Read-only access to financial reports', 'hunters_run')
ON CONFLICT (key) DO NOTHING;

-- Insert permissions for Hunters Run
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

-- Assign permissions to roles
INSERT INTO platform.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform.roles r
CROSS JOIN platform.permissions p
WHERE r.key = 'hr.admin' AND p.product_key = 'hunters_run'
ON CONFLICT DO NOTHING;

-- Manager role (subset of admin)
INSERT INTO platform.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform.roles r
CROSS JOIN platform.permissions p
WHERE r.key = 'hr.manager' 
  AND p.key IN (
    'hr.work_orders.read', 'hr.work_orders.write', 'hr.work_orders.assign',
    'hr.properties.read', 'hr.units.read', 'hr.units.write',
    'hr.tenants.read', 'hr.tenants.write', 'hr.leases.read',
    'hr.evidence.read', 'hr.evidence.write'
  )
ON CONFLICT DO NOTHING;

-- Technician role
INSERT INTO platform.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform.roles r
CROSS JOIN platform.permissions p
WHERE r.key = 'hr.technician'
  AND p.key IN (
    'hr.work_orders.read', 'hr.work_orders.close',
    'hr.evidence.write', 'hr.properties.read', 'hr.units.read'
  )
ON CONFLICT DO NOTHING;

-- Tenant role
INSERT INTO platform.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform.roles r
CROSS JOIN platform.permissions p
WHERE r.key = 'hr.tenant'
  AND p.key IN ('hr.work_orders.write')
ON CONFLICT DO NOTHING;

-- Leasing role
INSERT INTO platform.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform.roles r
CROSS JOIN platform.permissions p
WHERE r.key = 'hr.leasing'
  AND p.key IN (
    'hr.properties.read', 'hr.units.read', 'hr.units.write',
    'hr.tenants.read', 'hr.tenants.write', 'hr.leases.read', 'hr.leases.write'
  )
ON CONFLICT DO NOTHING;

-- Accounting role
INSERT INTO platform.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform.roles r
CROSS JOIN platform.permissions p
WHERE r.key = 'hr.accounting'
  AND p.key IN (
    'hr.charges.read', 'hr.payments.read', 'hr.audit.read'
  )
ON CONFLICT DO NOTHING;

-- Default legal notice templates
INSERT INTO hr.notice_templates (organization_id, name, notice_type, body) VALUES
('00000000-0000-0000-0000-000000000000', 'Standard Pay or Quit Notice', 'pay_or_quit', 
'TO: {{tenant_name}}
TENANT(S) IN POSSESSION OF THE PREMISES AT: {{property_address}}

YOU ARE HEREBY NOTIFIED that the rent on the above-described premises occupied by you, in the amount of ${{amount_owed}}, for the period from {{period_start}} to {{period_end}}, is now due and payable.

YOU ARE HEREBY REQUIRED to pay the said rent in full within {{cure_period_days}} days or to quit and deliver up the possession of the above-described premises to the undersigned, or legal proceedings will be instituted against you to recover possession of said premises, to declare the forfeiture of the lease or rental agreement under which you occupy said premises and to recover rents and damages, together with court costs and attorney fees according to the terms of your lease.

Date: {{issue_date}}
Landlord/Agent: {{landlord_name}}'),

('00000000-0000-0000-0000-000000000000', 'Lease Violation Notice', 'cure_or_quit',
'TO: {{tenant_name}}
TENANT(S) IN POSSESSION OF THE PREMISES AT: {{property_address}}

YOU ARE HEREBY NOTIFIED that you have violated the following provision(s) of your lease agreement:

{{violation_details}}

YOU ARE HEREBY REQUIRED to cure the above-mentioned violation(s) within {{cure_period_days}} days of service of this notice or to quit and deliver up possession of the above-described premises to the undersigned, or legal proceedings will be instituted against you to recover possession of said premises.

Date: {{issue_date}}
Landlord/Agent: {{landlord_name}}'),

('00000000-0000-0000-0000-000000000000', 'Entry Notice', 'entry_notice',
'TO: {{tenant_name}}
TENANT(S) IN POSSESSION OF THE PREMISES AT: {{property_address}}

YOU ARE HEREBY NOTIFIED that on {{entry_date}} at approximately {{entry_time}}, the landlord or landlord''s agent will enter the above-described premises for the following purpose(s):

{{entry_reason}}

If the above-described date and time are inconvenient, please contact the undersigned to arrange a more convenient appointment.

Date: {{issue_date}}
Landlord/Agent: {{landlord_name}}
Contact: {{contact_info}}')
ON CONFLICT DO NOTHING;