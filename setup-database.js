#!/usr/bin/env node

const { Client } = require('pg');

async function setupDatabase() {
    console.log('🔧 Setting up database for Windows Docker...');
    
    let client;
    
    try {
        // Try connecting with trust auth (no password)
        client = new Client({
            host: 'localhost',
            port: 5432,
            database: 'postgres',  // Connect to postgres DB first
            user: 'postgres',
            password: 'postgres'  // Try with default password
        });
        
        await client.connect();
        console.log('✅ Connected to PostgreSQL');
        
        // Create unified database if it doesn't exist
        try {
            await client.query('CREATE DATABASE unified');
            console.log('✅ Created unified database');
        } catch (error) {
            if (error.code === '42P04') {
                console.log('✅ unified database already exists');
            } else {
                throw error;
            }
        }
        
        await client.end();
        
        // Now connect to unified database
        client = new Client({
            host: 'localhost',
            port: 5432,
            database: 'unified',
            user: 'postgres',
            password: 'postgres'
        });
        
        await client.connect();
        
        // Create hr schema
        await client.query('CREATE SCHEMA IF NOT EXISTS hr');
        console.log('✅ Created hr schema');
        
        // Create api_role
        try {
            await client.query('CREATE ROLE api_role');
            console.log('✅ Created api_role');
        } catch (error) {
            if (error.code === '42710') {
                console.log('✅ api_role already exists');
            } else {
                throw error;
            }
        }
        
        // Grant permissions
        await client.query('GRANT USAGE ON SCHEMA hr TO api_role');
        await client.query('GRANT CREATE ON SCHEMA hr TO api_role');
        console.log('✅ Granted permissions to api_role');
        
        console.log('🎉 Database setup complete!');
        
    } catch (error) {
        console.error('❌ Database setup failed:', error.message);
        process.exit(1);
    } finally {
        if (client) {
            await client.end();
        }
    }
}

setupDatabase();