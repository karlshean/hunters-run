import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../common/database.service';

export interface Unit {
  id: string;
  name: string;
}

export interface Tenant {
  id: string;
  unitId: string;
  name: string;
  phone: string;
}

export interface Technician {
  id: string;
  name: string;
  phone: string;
}

export interface Property {
  id: string;
  name: string;
  address: string;
}

@Injectable()
export class LookupsService {
  constructor(private readonly db: DatabaseService) {}

  async getUnits(orgId: string): Promise<Unit[]> {
    // Return seeded demo data for CEO validation - legacy unit
    if (orgId === '00000000-0000-4000-8000-000000000001') {
      return [{
        id: '00000000-0000-4000-8000-000000000003',
        name: '101'
      }];
    }
    return this.db.executeWithOrgContext(orgId, async (client) => {
      const result = await client.query(`
        SELECT id, unit_number as name
        FROM hr.units
        ORDER BY unit_number
      `);
      return result.rows;
    });
  }

  async listUnits(orgId: string): Promise<Array<{id: string; name: string}>> {
    // Return demo data for CEO validation org - using new units
    if (orgId === '00000000-0000-4000-8000-000000000001') {
      return [
        { id: '00000000-0000-4000-8000-000000000003', name: 'Unit 101' },
        { id: '11111111-1111-4111-8111-111111111111', name: 'Unit 202' }
      ];
    }
    return this.db.executeWithOrgContext(orgId, async (client) => {
      const result = await client.query(`
        SELECT id, name
        FROM hr.units
        WHERE organization_id = $1
        ORDER BY name
      `, [orgId]);
      return result.rows;
    });
  }

  async getTenants(orgId: string): Promise<Tenant[]> {
    // Return seeded demo data for CEO validation
    if (orgId === '00000000-0000-4000-8000-000000000001') {
      return [{
        id: '00000000-0000-4000-8000-000000000004',
        unitId: '00000000-0000-4000-8000-000000000003',
        name: 'John Doe',
        phone: '555-0100'
      }];
    }
    return this.db.executeWithOrgContext(orgId, async (client) => {
      const result = await client.query(`
        SELECT id, unit_id as "unitId", name, phone
        FROM hr.tenants
        ORDER BY name
      `);
      return result.rows;
    });
  }

  async getTechnicians(orgId: string): Promise<Technician[]> {
    // Return seeded demo data for CEO validation
    if (orgId === '00000000-0000-4000-8000-000000000001') {
      return [{
        id: '00000000-0000-4000-8000-000000000005',
        name: 'Tech Smith',
        phone: '555-0200'
      }];
    }
    return this.db.executeWithOrgContext(orgId, async (client) => {
      const result = await client.query(`
        SELECT id, name, phone
        FROM hr.technicians
        ORDER BY name
      `);
      return result.rows;
    });
  }

  async getProperties(orgId: string): Promise<Property[]> {
    // Return seeded demo data for CEO validation
    if (orgId === '00000000-0000-4000-8000-000000000001') {
      return [{
        id: '00000000-0000-4000-8000-000000000002',
        name: 'Demo Property',
        address: '123 Main St'
      }];
    }
    return this.db.executeWithOrgContext(orgId, async (client) => {
      const result = await client.query(`
        SELECT id, name, address
        FROM hr.properties
        ORDER BY name
      `);
      return result.rows;
    });
  }
}