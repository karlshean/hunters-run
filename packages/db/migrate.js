#!/usr/bin/env node

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuration
const DEFAULT_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/unified';
const DATABASE_URL = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// Parse command line arguments
const args = process.argv.slice(2);
const urlArg = args.find(arg => arg.startsWith('--url='));
const finalUrl = urlArg ? urlArg.replace('--url=', '') : DATABASE_URL;

async function createMigrationsTable(client) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS hr.migrations (
            id SERIAL PRIMARY KEY,
            filename VARCHAR(255) NOT NULL UNIQUE,
            executed_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);
}

async function getExecutedMigrations(client) {
    const result = await client.query('SELECT filename FROM hr.migrations ORDER BY id');
    return result.rows.map(row => row.filename);
}

async function markMigrationExecuted(client, filename) {
    await client.query('INSERT INTO hr.migrations (filename) VALUES ($1)', [filename]);
}

async function getAllMigrationFiles() {
    const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter(file => file.endsWith('.sql'))
        .sort();
    return files;
}

async function executeMigration(client, filename) {
    const filepath = path.join(MIGRATIONS_DIR, filename);
    const sql = fs.readFileSync(filepath, 'utf8');
    
    console.log(`Executing migration: ${filename}`);
    await client.query(sql);
    await markMigrationExecuted(client, filename);
    console.log(`✓ Completed: ${filename}`);
}

async function resetDatabase(client) {
    console.log('🔥 Resetting database...');
    
    // Drop schema and recreate
    await client.query('DROP SCHEMA IF EXISTS hr CASCADE');
    await client.query('CREATE SCHEMA hr');
    
    // Drop migrations table if exists
    await client.query('DROP TABLE IF EXISTS hr.migrations');
    
    console.log('✓ Database reset complete');
}

async function runMigrations() {
    let client;
    let connected = false;
    
    // Check if we're using a non-local URL (Supabase or other managed service)
    const isLocalDocker = finalUrl === DEFAULT_DATABASE_URL;
    
    if (isLocalDocker) {
        // Method 1: Docker exec (most reliable for Windows local development)
        try {
            const { execSync } = require('child_process');
            execSync('docker exec hunters-run-postgres-1 psql -U postgres -d unified -c "SELECT 1"', { stdio: 'pipe' });
            console.log('📊 Docker connection verified');
            // Use regular connection now that we know Docker works
            client = new Client({ 
                host: 'localhost',
                port: 5432,
                database: 'unified',
                user: 'postgres'
                // No password for Docker postgres
            });
            await client.connect();
            connected = true;
            console.log('📊 Connected to database via Docker');
        } catch (error) {
            console.log('Docker connection failed, trying connection string...');
            if (client) await client.end().catch(() => {});
        }
    }
    
    // Method 2: Connection string (works for both local and Supabase)
    if (!connected) {
        try {
            const clientConfig = { connectionString: finalUrl };
            
            // For SSL connections (Supabase), ensure SSL is configured properly
            if (finalUrl.includes('sslmode=require') || finalUrl.includes('supabase.co')) {
                clientConfig.ssl = {
                    rejectUnauthorized: false // Required for Supabase
                };
            }
            
            client = new Client(clientConfig);
            await client.connect();
            connected = true;
            console.log('📊 Connected to database via connection string');
        } catch (error) {
            console.log('Connection string failed, trying explicit parameters...');
            if (client) await client.end().catch(() => {});
        }
    }
    
    // Method 3: Explicit parameters (fallback for local Docker)
    if (!connected && isLocalDocker) {
        try {
            client = new Client({
                host: 'localhost',
                port: 5432,
                database: 'unified',
                user: 'postgres'
                // No password - Docker postgres doesn't require one by default
            });
            await client.connect();
            connected = true;
            console.log('📊 Connected to database via explicit parameters (no password)');
        } catch (error) {
            console.error('❌ All connection methods failed');
            console.error('Please ensure Docker is running and database is accessible');
            process.exit(1);
        }
    }
    
    if (!connected) {
        console.error('❌ Failed to connect to database');
        console.error(`Database URL: ${finalUrl.replace(/:[^:@]*@/, ':***@')}`); // Mask password in logs
        process.exit(1);
    }
    
    try {

        // Check for reset flag
        if (process.argv.includes('--reset')) {
            await resetDatabase(client);
        }

        // Ensure migrations table exists
        await createMigrationsTable(client);

        // Get migration files and executed migrations
        const allMigrations = await getAllMigrationFiles();
        const executedMigrations = await getExecutedMigrations(client);

        // Find pending migrations
        const pendingMigrations = allMigrations.filter(
            migration => !executedMigrations.includes(migration)
        );

        if (pendingMigrations.length === 0) {
            console.log('✅ No pending migrations');
            return;
        }

        console.log(`📋 Found ${pendingMigrations.length} pending migration(s)`);

        // Execute pending migrations
        for (const migration of pendingMigrations) {
            await executeMigration(client, migration);
        }

        console.log('🎉 All migrations completed successfully!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

// Run migrations
runMigrations();