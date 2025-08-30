-- Database Role Setup for Hunters Run
-- This script creates application and migration roles with least privilege

-- 1. Create application user (runtime connections only)
CREATE ROLE app_user WITH 
  LOGIN 
  PASSWORD 'secure_app_user_password_2025'
  NOSUPERUSER 
  NOCREATEDB 
  NOCREATEROLE 
  NOINHERIT 
  NOREPLICATION 
  NOBYPASSRLS;

-- 2. Create migration user (schema changes only)  
CREATE ROLE migration_user WITH 
  LOGIN 
  PASSWORD 'secure_migration_password_2025'
  NOSUPERUSER 
  NOCREATEDB 
  NOCREATEROLE 
  NOINHERIT 
  NOREPLICATION 
  NOBYPASSRLS;

-- 3. Grant basic connection privileges
GRANT CONNECT ON DATABASE hunters_run TO app_user;
GRANT CONNECT ON DATABASE hunters_run TO migration_user;

-- 4. Grant schema usage
GRANT USAGE ON SCHEMA public TO app_user;
GRANT USAGE ON SCHEMA hr TO app_user;
GRANT USAGE ON SCHEMA platform TO app_user;
GRANT USAGE ON SCHEMA audit TO app_user;

GRANT USAGE ON SCHEMA public TO migration_user;
GRANT USAGE ON SCHEMA hr TO migration_user;
GRANT USAGE ON SCHEMA platform TO migration_user;
GRANT USAGE ON SCHEMA audit TO migration_user;

-- 5. Grant table privileges for app_user (CRUD operations only)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA hr TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA platform TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA audit TO app_user;

-- Grant sequence usage for auto-increment fields
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA hr TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA platform TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA audit TO app_user;

-- 6. Grant migration privileges (schema changes)
GRANT CREATE ON SCHEMA hr TO migration_user;
GRANT CREATE ON SCHEMA platform TO migration_user;  
GRANT CREATE ON SCHEMA audit TO migration_user;

-- Allow migration user to modify existing objects
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA hr TO migration_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA platform TO migration_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA audit TO migration_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA hr TO migration_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA platform TO migration_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA audit TO migration_user;

-- 7. Default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA hr GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA platform GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA audit GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA hr GRANT USAGE, SELECT ON SEQUENCES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA platform GRANT USAGE, SELECT ON SEQUENCES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA audit GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- Migration user gets full privileges on future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA hr GRANT ALL ON TABLES TO migration_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA platform GRANT ALL ON TABLES TO migration_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA audit GRANT ALL ON TABLES TO migration_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA hr GRANT ALL ON SEQUENCES TO migration_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA platform GRANT ALL ON SEQUENCES TO migration_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA audit GRANT ALL ON SEQUENCES TO migration_user;

-- 8. Verify role configuration
SELECT 
  rolname,
  rolsuper,
  rolinherit, 
  rolcreaterole,
  rolcreatedb,
  rolcanlogin,
  rolreplication,
  rolbypassrls
FROM pg_roles 
WHERE rolname IN ('app_user', 'migration_user')
ORDER BY rolname;