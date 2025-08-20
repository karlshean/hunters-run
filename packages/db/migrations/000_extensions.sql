-- Enable required PostgreSQL extensions for Supabase
-- This migration must run first to ensure extensions are available
-- for subsequent schema and RLS setup

-- UUID extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable Row Level Security support
-- (Note: RLS is built into PostgreSQL, no extension needed)

-- Optional: Enable additional extensions that may be useful
-- CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- Trigram matching for fuzzy text search
-- CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";  -- Query performance monitoring

-- Supabase automatically enables these extensions:
-- - pgcrypto (cryptographic functions)  
-- - pgjwt (JWT token support)
-- - pg_graphql (GraphQL API)
-- - pg_stat_statements (query stats)
-- - uuid-ossp (UUID generation)

-- Note: Some extensions may require superuser privileges to install
-- Supabase handles most common extensions automatically