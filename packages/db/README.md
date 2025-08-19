# Database Package - Hunters Run

## Overview

This package contains the PostgreSQL schema and migrations for the Hunters Run maintenance management system.

## Features

- **Complete Maintenance Workflow Schema**: Properties, units, tenants, technicians, work orders, and evidence
- **Row Level Security (RLS)**: Organization-based data isolation
- **Audit Trail**: Cryptographic hash chain for tamper-evident event logging
- **PostgreSQL ENUMs**: Type-safe priority and status enums
- **Foreign Key Constraints**: Referential integrity across all entities

## Schema Structure

### Core Tables

- `hr.properties` - Properties managed by organizations
- `hr.units` - Individual units within properties  
- `hr.tenants` - Tenant information linked to units
- `hr.technicians` - Maintenance technicians
- `hr.work_orders` - Maintenance requests and work orders
- `hr.evidence` - Files and documentation attached to work orders
- `hr.events` - Tamper-evident audit log with hash chain

### ENUMs

- `hr.priority`: 'low' | 'normal' | 'high'
- `hr.status`: 'new' | 'triaged' | 'assigned' | 'in_progress' | 'completed' | 'closed' | 'reopened'

## Running Migrations

```bash
# Run all pending migrations
npm run migrate

# Reset database and run all migrations
npm run migrate:reset
```

## Row Level Security

All tables are protected with RLS policies that filter by organization_id:

```sql
-- Set organization context before queries
SET app.current_org = '550e8400-e29b-41d4-a716-446655440000';

-- Now all queries automatically filter by this org
SELECT * FROM hr.work_orders; -- Only shows work orders for the set org
```

## Audit System

The audit system provides:

- **Cryptographic Hash Chain**: Each event links to the previous event's hash
- **Tamper Detection**: Any modification breaks the hash chain
- **Complete History**: All changes are logged with full context

### Creating Audit Events

```sql
SELECT hr.create_audit_event(
    '550e8400-e29b-41d4-a716-446655440000'::uuid, -- organization_id
    'create',                                      -- event_type
    'work_order',                                  -- entity_type
    '123e4567-e89b-12d3-a456-426614174000'::uuid, -- entity_id
    '{"title": "Fix leaky faucet", "priority": "normal"}'::jsonb -- new_values
);
```

## Testing

The migrations have been tested with:
- ✅ Schema creation
- ✅ ENUM creation  
- ✅ Table creation with constraints
- ✅ RLS policy enforcement
- ✅ Hash chain functionality
- ✅ Foreign key relationships

## Requirements

- PostgreSQL 16+
- Extensions: uuid-ossp, pgcrypto