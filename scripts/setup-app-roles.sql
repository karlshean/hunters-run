-- Database Role Setup for Hunters Run
-- This script is idempotent - safe to run multiple times

-- 1) Create or update app_user role (runtime)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD 'StrongTempAppUser!123'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;
    RAISE NOTICE 'Created role: app_user';
  ELSE
    EXECUTE format('ALTER ROLE app_user WITH PASSWORD %L', 'StrongTempAppUser!123');
    ALTER ROLE app_user NOSUPERUSER NOBYPASSRLS;
    RAISE NOTICE 'Updated role: app_user';
  END IF;
END$$;

-- 2) Create or update migration_role (DDL operations)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'migration_role') THEN
    CREATE ROLE migration_role LOGIN PASSWORD 'StrongTempMigration!123'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT;
    RAISE NOTICE 'Created role: migration_role';
  ELSE
    EXECUTE format('ALTER ROLE migration_role WITH PASSWORD %L', 'StrongTempMigration!123');
    ALTER ROLE migration_role NOSUPERUSER NOBYPASSRLS;
    RAISE NOTICE 'Updated role: migration_role';
  END IF;
END$$;

-- 3) Grants for app_user (runtime - RLS handles isolation)
GRANT CONNECT ON DATABASE postgres TO app_user;
GRANT USAGE ON SCHEMA hr TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA hr TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA hr TO app_user;

-- Default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA hr
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA hr
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- 4) Grants for migration_role (DDL operations)
GRANT CONNECT ON DATABASE postgres TO migration_role;
GRANT USAGE, CREATE ON SCHEMA hr TO migration_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA hr TO migration_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA hr TO migration_role;

-- Default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA hr
  GRANT ALL PRIVILEGES ON TABLES TO migration_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA hr
  GRANT ALL PRIVILEGES ON SEQUENCES TO migration_role;

-- 5) Also grant necessary permissions on platform and audit schemas for app_user
GRANT USAGE ON SCHEMA platform TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA platform TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA platform TO app_user;

GRANT USAGE ON SCHEMA audit TO app_user;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA audit TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA audit TO app_user;

-- Verify roles were created correctly
SELECT 
  rolname,
  rolsuper,
  rolcreatedb,
  rolcreaterole,
  rolreplication,
  rolbypassrls,
  rolcanlogin
FROM pg_roles 
WHERE rolname IN ('app_user', 'migration_role');