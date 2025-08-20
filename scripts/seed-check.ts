#!/usr/bin/env ts-node

import pkg from 'pg';
const { Client } = pkg;

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

interface SeedCheckResult {
  item: string;
  exists: boolean;
  details?: string;
  error?: string;
}

class SeedChecker {
  private client: any;
  private results: SeedCheckResult[] = [];
  
  constructor() {
    const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/unified';
    this.client = new Client({ connectionString });
  }

  private log(message: string, color: string = RESET) {
    console.log(`${color}${message}${RESET}`);
  }

  private success(message: string) {
    this.log(`✅ ${message}`, GREEN);
  }

  private error(message: string) {
    this.log(`❌ ${message}`, RED);
  }

  private warning(message: string) {
    this.log(`⚠️  ${message}`, YELLOW);
  }

  async connect() {
    try {
      await this.client.connect();
      this.log('🔌 Connected to database');
    } catch (error) {
      this.error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  }

  async checkOrganization(): Promise<SeedCheckResult> {
    const expectedOrgId = '00000000-0000-4000-8000-000000000001';
    
    try {
      const result = await this.client.query(
        'SELECT id, name FROM hr.organizations WHERE id = $1',
        [expectedOrgId]
      );

      if (result.rows.length > 0) {
        const org = result.rows[0];
        return {
          item: 'Fixed Organization',
          exists: true,
          details: `Found: ${org.name} (${org.id})`
        };
      } else {
        return {
          item: 'Fixed Organization',
          exists: false,
          error: `Expected organization ${expectedOrgId} not found`
        };
      }
    } catch (error) {
      return {
        item: 'Fixed Organization',
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async checkTenant(): Promise<SeedCheckResult> {
    const expectedTenantId = '00000000-0000-4000-8000-000000000004';
    
    try {
      const result = await this.client.query(
        'SELECT id, name FROM hr.tenants WHERE id = $1',
        [expectedTenantId]
      );

      if (result.rows.length > 0) {
        const tenant = result.rows[0];
        return {
          item: 'Fixed Tenant',
          exists: true,
          details: `Found: ${tenant.name} (${tenant.id})`
        };
      } else {
        return {
          item: 'Fixed Tenant',
          exists: false,
          error: `Expected tenant ${expectedTenantId} not found`
        };
      }
    } catch (error) {
      return {
        item: 'Fixed Tenant',
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async checkUnit(): Promise<SeedCheckResult> {
    const expectedUnitId = '00000000-0000-4000-8000-000000000003';
    
    try {
      const result = await this.client.query(
        'SELECT id, unit_number FROM hr.units WHERE id = $1',
        [expectedUnitId]
      );

      if (result.rows.length > 0) {
        const unit = result.rows[0];
        return {
          item: 'Fixed Unit',
          exists: true,
          details: `Found: Unit ${unit.unit_number} (${unit.id})`
        };
      } else {
        return {
          item: 'Fixed Unit',
          exists: false,
          error: `Expected unit ${expectedUnitId} not found`
        };
      }
    } catch (error) {
      return {
        item: 'Fixed Unit',
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async checkTechnician(): Promise<SeedCheckResult> {
    const expectedTechId = '00000000-0000-4000-8000-000000000005';
    
    try {
      const result = await this.client.query(
        'SELECT id, name FROM hr.technicians WHERE id = $1',
        [expectedTechId]
      );

      if (result.rows.length > 0) {
        const tech = result.rows[0];
        return {
          item: 'Fixed Technician',
          exists: true,
          details: `Found: ${tech.name} (${tech.id})`
        };
      } else {
        return {
          item: 'Fixed Technician',
          exists: false,
          error: `Expected technician ${expectedTechId} not found`
        };
      }
    } catch (error) {
      return {
        item: 'Fixed Technician',
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async checkCharges(): Promise<SeedCheckResult> {
    try {
      const result = await this.client.query(
        'SELECT COUNT(*) as count FROM payments.charges'
      );

      const count = parseInt(result.rows[0].count);
      
      if (count > 0) {
        return {
          item: 'Payment Charges',
          exists: true,
          details: `Found ${count} charge(s) in payments.charges`
        };
      } else {
        return {
          item: 'Payment Charges',
          exists: false,
          error: 'No charges found in payments.charges table'
        };
      }
    } catch (error) {
      return {
        item: 'Payment Charges',
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async checkDatabaseExtensions(): Promise<SeedCheckResult> {
    try {
      const result = await this.client.query(
        "SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp', 'pgcrypto')"
      );

      const extensions = result.rows.map(row => row.extname);
      const hasUuid = extensions.includes('uuid-ossp');
      const hasCrypto = extensions.includes('pgcrypto');

      if (hasUuid && hasCrypto) {
        return {
          item: 'Database Extensions',
          exists: true,
          details: 'uuid-ossp and pgcrypto extensions are installed'
        };
      } else {
        const missing = [];
        if (!hasUuid) missing.push('uuid-ossp');
        if (!hasCrypto) missing.push('pgcrypto');
        
        return {
          item: 'Database Extensions',
          exists: false,
          error: `Missing extensions: ${missing.join(', ')}`
        };
      }
    } catch (error) {
      return {
        item: 'Database Extensions',
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async runAllChecks() {
    this.log(`${BOLD}🔍 Running Seed Data Validation${RESET}\n`);

    const checks = [
      this.checkDatabaseExtensions(),
      this.checkOrganization(),
      this.checkTenant(),
      this.checkUnit(),
      this.checkTechnician(),
      this.checkCharges()
    ];

    this.results = await Promise.all(checks);
    
    this.displayResults();
    
    const hasFailures = this.results.some(result => !result.exists);
    
    if (hasFailures) {
      this.log(`\n${RED}${BOLD}❌ Seed validation failed!${RESET}`);
      this.log(`${YELLOW}Run the following to seed the database:${RESET}`);
      this.log(`  npm run seed`);
      this.log(`  # or for manual seeding:`);
      this.log(`  docker exec -i hunters-run-postgres-1 psql -U postgres -d unified < packages/db/seeds/ceo-demo-data.sql`);
      process.exit(1);
    } else {
      this.log(`\n${GREEN}${BOLD}✅ All seed data validation checks passed!${RESET}`);
      this.log(`${GREEN}Database is ready for demo.${RESET}`);
      process.exit(0);
    }
  }

  private displayResults() {
    this.log(`${BOLD}Validation Results:${RESET}\n`);
    
    this.results.forEach(result => {
      if (result.exists) {
        this.success(`${result.item}: ${result.details}`);
      } else {
        this.error(`${result.item}: ${result.error}`);
      }
    });
  }

  async disconnect() {
    try {
      await this.client.end();
    } catch (error) {
      this.warning(`Error disconnecting: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

async function main() {
  const checker = new SeedChecker();
  
  try {
    await checker.connect();
    await checker.runAllChecks();
  } catch (error) {
    console.error(`❌ Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  } finally {
    await checker.disconnect();
  }
}

// Run the script if this is the main module
main().catch(error => {
  console.error(`${RED}Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}${RESET}`);
  process.exit(1);
});