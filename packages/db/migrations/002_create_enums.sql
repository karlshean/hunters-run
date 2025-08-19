-- Migration 002: Create PostgreSQL ENUMs
-- Creates priority and status enums as specified

BEGIN;

-- Create priority enum
CREATE TYPE hr.priority AS ENUM ('low', 'normal', 'high');

-- Create status enum for work orders
CREATE TYPE hr.status AS ENUM ('new', 'triaged', 'assigned', 'in_progress', 'completed', 'closed', 'reopened');

COMMIT;