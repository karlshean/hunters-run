#!/usr/bin/env node

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuration
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/unified';
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

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
    // Try different connection methods for Windows Docker
    let client;
    let connected = false;
    
    // Method 1: Connection string
    try {
        client = new Client({ connectionString: DATABASE_URL });
        await client.connect();
        connected = true;
        console.log('📊 Connected to database via connection string');
    } catch (error) {
        console.log('Connection string failed, trying explicit parameters...');
        if (client) await client.end().catch(() => {});
    }
    
    // Method 2: Explicit parameters
    if (!connected) {
        try {
            client = new Client({
                host: 'localhost',
                port: 5432,
                database: 'unified',
                user: 'postgres',
                password: ''  // Try empty password for trust auth
            });
            await client.connect();
            connected = true;
            console.log('📊 Connected to database via explicit parameters (empty password)');
        } catch (error) {
            if (client) await client.end().catch(() => {});
        }
    }
    
    // Method 3: With password
    if (!connected) {
        try {
            client = new Client({
                host: 'localhost',
                port: 5432,
                database: 'unified',
                user: 'postgres',
                password: 'postgres'
            });
            await client.connect();
            connected = true;
            console.log('📊 Connected to database via explicit parameters (with password)');
        } catch (error) {
            console.error('❌ All connection methods failed');
            console.error('Please ensure Docker is running and database is accessible');
            process.exit(1);
        }
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