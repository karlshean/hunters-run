#!/usr/bin/env node
// Database connection utility with retry logic and consistent configuration
// Matches the same connection logic as migrations for consistency

const { Client } = require('pg');

class DatabaseConnection {
    constructor(options = {}) {
        this.maxRetries = options.maxRetries || 3;
        this.retryDelay = options.retryDelay || 2000;
        this.timeout = options.timeout || 10000;
        this.verbose = options.verbose || false;
        this.client = null;
        this.connected = false;
    }

    log(message, type = 'info') {
        if (!this.verbose && type === 'debug') return;
        
        const colors = {
            info: '\x1b[36m',  // Cyan
            success: '\x1b[32m', // Green
            warning: '\x1b[33m', // Yellow
            error: '\x1b[31m',   // Red
            debug: '\x1b[90m'    // Gray
        };
        
        const reset = '\x1b[0m';
        const prefix = type === 'error' ? '[ERR]' : 
                      type === 'success' ? '[OK] ' :
                      type === 'warning' ? '[WARN]' :
                      type === 'debug' ? '[DBG]' : '[INFO]';
        
        console.log(`${colors[type]}${prefix} ${message}${reset}`);
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async tryConnection(method, config) {
        try {
            if (this.client) {
                await this.client.end().catch(() => {});
            }
            
            this.client = new Client(config);
            
            // Add timeout to connection attempt
            const connectPromise = this.client.connect();
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`Connection timeout after ${this.timeout}ms`)), this.timeout);
            });
            
            await Promise.race([connectPromise, timeoutPromise]);
            
            // Test the connection with a simple query
            await this.client.query('SELECT 1');
            
            this.connected = true;
            this.log(`Connected to database via ${method}`, 'success');
            return true;
            
        } catch (error) {
            this.log(`${method} failed: ${error.message}`, 'debug');
            if (this.client) {
                await this.client.end().catch(() => {});
                this.client = null;
            }
            return false;
        }
    }

    async tryDockerConnection() {
        // Try Docker exec approach first (most reliable for Windows)
        try {
            const { execSync } = require('child_process');
            execSync('docker exec hunters-run-postgres-1 psql -U postgres -d unified -c "SELECT 1"', { stdio: 'pipe' });
            this.log('Docker exec connection verified', 'debug');
            return true;
        } catch (error) {
            this.log(`Docker exec failed: ${error.message}`, 'debug');
            return false;
        }
    }

    async connect() {
        const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/unified';
        
        // Method 1: Docker connection with no password (like migrate.js)
        const dockerSuccess = await this.tryConnection('Docker connection', {
            host: 'localhost',
            port: 5432,
            database: 'unified',
            user: 'postgres'
            // No password - Docker postgres often doesn't require one by default
        });
        
        if (dockerSuccess) return true;

        // Method 2: Connection string (same as migrate.js)
        const connectionStringSuccess = await this.tryConnection('connection string', {
            connectionString: DATABASE_URL
        });
        
        if (connectionStringSuccess) return true;

        // Method 3: Docker connection with password
        const dockerPasswordSuccess = await this.tryConnection('Docker with password', {
            host: 'localhost',
            port: 5432,
            database: 'unified',
            user: 'postgres',
            password: 'postgres'
        });

        if (dockerPasswordSuccess) return true;

        // All methods failed
        this.log('All connection methods failed', 'error');
        return false;
    }

    async connectWithRetry() {
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            this.log(`Connection attempt ${attempt}/${this.maxRetries}`, 'info');
            
            const success = await this.connect();
            if (success) {
                return true;
            }
            
            if (attempt < this.maxRetries) {
                this.log(`Retrying in ${this.retryDelay}ms...`, 'info');
                await this.sleep(this.retryDelay);
            }
        }
        
        this.log('Failed to connect after all retry attempts', 'error');
        return false;
    }

    async query(sql, params = []) {
        if (!this.connected || !this.client) {
            throw new Error('Database not connected. Call connectWithRetry() first.');
        }

        try {
            const result = await this.client.query(sql, params);
            return result;
        } catch (error) {
            this.log(`Query failed: ${error.message}`, 'error');
            throw error;
        }
    }

    async testConnection() {
        try {
            const result = await this.query('SELECT NOW() as current_time, version() as pg_version');
            this.log(`Database test successful: ${result.rows[0].pg_version.split(',')[0]}`, 'success');
            return true;
        } catch (error) {
            this.log(`Database test failed: ${error.message}`, 'error');
            return false;
        }
    }

    async close() {
        if (this.client) {
            await this.client.end();
            this.client = null;
            this.connected = false;
            this.log('Database connection closed', 'debug');
        }
    }
}

// Export for use as module
module.exports = DatabaseConnection;

// CLI usage when run directly
if (require.main === module) {
    async function main() {
        const db = new DatabaseConnection({ verbose: true, maxRetries: 3 });
        
        console.log('🔌 Testing database connection...');
        
        const connected = await db.connectWithRetry();
        if (!connected) {
            console.log('❌ Database connection failed');
            process.exit(1);
        }
        
        const tested = await db.testConnection();
        if (!tested) {
            console.log('❌ Database test failed');
            process.exit(1);
        }
        
        await db.close();
        console.log('✅ Database connection test completed successfully');
    }
    
    main().catch(error => {
        console.error('❌ Database connection test failed:', error.message);
        process.exit(1);
    });
}