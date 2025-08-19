import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../common/database.service';

export interface Unit {
  id: string;
  propertyId: string;
  unitNumber: string;
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
    return this.db.executeWithOrgContext(orgId, async (client) => {
      const result = await client.query(`
        SELECT id, property_id as "propertyId", unit_number as "unitNumber"
        FROM hr.units
        ORDER BY unit_number
      `);
      return result.rows;
    });
  }

  async getTenants(orgId: string): Promise<Tenant[]> {
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