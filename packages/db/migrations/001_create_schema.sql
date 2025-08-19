-- Migration 001: Create schema and basic setup
-- Creates the hr schema and basic extensions

BEGIN;

-- Create the hr schema
CREATE SCHEMA IF NOT EXISTS hr;

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for hash functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

COMMIT;