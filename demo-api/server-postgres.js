// Enhanced Express server with PostgreSQL support for work orders demo
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');

const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection pool
let pool = null;
let useDatabase = false;

// Try to connect to PostgreSQL
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://app_user:secure_app_user_password_2025@localhost:5432/hunters_run_prod';

async function initializeDatabase() {
  try {
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    
    // Test connection
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    
    useDatabase = true;
    console.log('✅ Connected to PostgreSQL - Using real database');
    
    // Get sample org IDs for testing
    const orgResult = await pool.query('SELECT DISTINCT organization_id FROM hr.work_orders LIMIT 2');
    if (orgResult.rows.length > 0) {
      console.log('📊 Found organizations in hr.work_orders:');
      orgResult.rows.forEach((row, index) => {
        console.log(`   Org ${index + 1}: ${row.organization_id}`);
      });
    }
    
  } catch (error) {
    console.log('❌ PostgreSQL connection failed, using in-memory data');
    console.log(`   Error: ${error.message}`);
    useDatabase = false;
  }
}

// In-memory fallback data
let workOrders = [
  {
    id: uuidv4(),
    title: "Fix leaky faucet",
    description: "Kitchen faucet is dripping constantly",
    status: "SUBMITTED",
    assignee: null,
    organization_id: "00000000-0000-0000-0000-000000000001",
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: uuidv4(),
    title: "Replace door lock",
    description: "Front door lock is not working properly", 
    status: "ASSIGNED",
    assignee: "John Smith",
    organization_id: "00000000-0000-0000-0000-000000000002",
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  }
];

// Helper function to set RLS context
async function setOrgContext(client, orgId) {
  if (!orgId) return;
  await client.query('SELECT set_config($1, $2, true)', ['app.org_id', orgId]);
}

// Helper function to validate org header
function validateOrgHeader(orgId) {
  if (!orgId) {
    return { valid: false, error: 'Missing required header: x-org-id' };
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(orgId)) {
    return { valid: false, error: 'Invalid organization ID format' };
  }
  
  return { valid: true };
}

// GET /api/v1/work-orders - List work orders
app.get('/api/v1/work-orders', async (req, res) => {
  const orgId = req.headers['x-org-id'];
  console.log(`GET /api/v1/work-orders (org: ${orgId || 'none'})`);
  
  const validation = validateOrgHeader(orgId);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: validation.error
    });
  }
  
  if (useDatabase && pool) {
    const client = await pool.connect();
    try {
      // Set RLS context
      await setOrgContext(client, orgId);
      
      // Query with RLS automatically filtering by organization
      const result = await client.query(`
        SELECT id, title, description, status, assignee, organization_id, created_at, updated_at 
        FROM hr.work_orders 
        ORDER BY created_at DESC
      `);
      
      console.log(`   Database returned ${result.rows.length} work orders for org ${orgId}`);
      
      res.json({
        success: true,
        data: result.rows
      });
      
    } catch (error) {
      console.error('Database error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Database query failed'
      });
    } finally {
      client.release();
    }
  } else {
    // Fallback to in-memory data with manual filtering
    const filtered = workOrders.filter(wo => wo.organization_id === orgId);
    console.log(`   In-memory returned ${filtered.length} work orders for org ${orgId}`);
    
    res.json({
      success: true,
      data: filtered
    });
  }
});

// GET /api/v1/work-orders/:id - Get work order by ID
app.get('/api/v1/work-orders/:id', async (req, res) => {
  const { id } = req.params;
  const orgId = req.headers['x-org-id'];
  console.log(`GET /api/v1/work-orders/${id} (org: ${orgId || 'none'})`);
  
  const validation = validateOrgHeader(orgId);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: validation.error
    });
  }
  
  if (useDatabase && pool) {
    const client = await pool.connect();
    try {
      // Set RLS context
      await setOrgContext(client, orgId);
      
      // Query with RLS automatically filtering by organization
      const result = await client.query(`
        SELECT id, title, description, status, assignee, organization_id, created_at, updated_at 
        FROM hr.work_orders 
        WHERE id = $1
      `, [id]);
      
      if (result.rows.length === 0) {
        console.log(`   Work order ${id} not found for org ${orgId}`);
        return res.status(404).json({
          success: false,
          error: 'Work order not found'
        });
      }
      
      console.log(`   Found work order ${id} for org ${orgId}`);
      res.json({
        success: true,
        data: result.rows[0]
      });
      
    } catch (error) {
      console.error('Database error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Database query failed'
      });
    } finally {
      client.release();
    }
  } else {
    // Fallback to in-memory data
    const workOrder = workOrders.find(wo => wo.id === id && wo.organization_id === orgId);
    
    if (!workOrder) {
      console.log(`   Work order ${id} not found for org ${orgId} (in-memory)`);
      return res.status(404).json({
        success: false,
        error: 'Work order not found'
      });
    }
    
    console.log(`   Found work order ${id} for org ${orgId} (in-memory)`);
    res.json({
      success: true,
      data: workOrder
    });
  }
});

// POST /api/v1/work-orders - Create new work order  
app.post('/api/v1/work-orders', async (req, res) => {
  const orgId = req.headers['x-org-id'];
  const { title, description } = req.body;
  console.log(`POST /api/v1/work-orders (org: ${orgId || 'none'})`, { title, description });
  
  const validation = validateOrgHeader(orgId);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: validation.error
    });
  }
  
  if (!title) {
    return res.status(400).json({
      success: false,
      error: 'Title is required'
    });
  }
  
  if (useDatabase && pool) {
    const client = await pool.connect();
    try {
      // Set RLS context
      await setOrgContext(client, orgId);
      
      // Insert with explicit organization_id
      const result = await client.query(`
        INSERT INTO hr.work_orders (id, organization_id, title, description, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'SUBMITTED', NOW(), NOW())
        RETURNING id, title, description, status, assignee, organization_id, created_at, updated_at
      `, [uuidv4(), orgId, title, description || '']);
      
      console.log(`   Created work order ${result.rows[0].id} for org ${orgId}`);
      res.json({
        success: true,
        data: result.rows[0]
      });
      
    } catch (error) {
      console.error('Database error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to create work order'
      });
    } finally {
      client.release();
    }
  } else {
    // Fallback to in-memory data
    const newWorkOrder = {
      id: uuidv4(),
      title,
      description: description || '',
      status: 'SUBMITTED',
      assignee: null,
      organization_id: orgId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    workOrders.unshift(newWorkOrder);
    console.log(`   Created work order ${newWorkOrder.id} for org ${orgId} (in-memory)`);
    
    res.json({
      success: true,
      data: newWorkOrder
    });
  }
});

// PATCH /api/v1/work-orders/:id - Update work order
app.patch('/api/v1/work-orders/:id', async (req, res) => {
  const { id } = req.params;
  const orgId = req.headers['x-org-id'];
  const updates = req.body;
  console.log(`PATCH /api/v1/work-orders/${id} (org: ${orgId || 'none'})`, updates);
  
  const validation = validateOrgHeader(orgId);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: validation.error
    });
  }
  
  if (useDatabase && pool) {
    const client = await pool.connect();
    try {
      // Set RLS context
      await setOrgContext(client, orgId);
      
      // Build dynamic update query
      const updateFields = [];
      const values = [id];
      let paramCount = 2;
      
      if (updates.status) {
        updateFields.push(`status = $${paramCount++}`);
        values.push(updates.status);
      }
      if (updates.assignee !== undefined) {
        updateFields.push(`assignee = $${paramCount++}`);
        values.push(updates.assignee);
      }
      if (updates.title) {
        updateFields.push(`title = $${paramCount++}`);
        values.push(updates.title);
      }
      if (updates.description !== undefined) {
        updateFields.push(`description = $${paramCount++}`);
        values.push(updates.description);
      }
      
      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid fields to update'
        });
      }
      
      updateFields.push('updated_at = NOW()');
      
      const result = await client.query(`
        UPDATE hr.work_orders 
        SET ${updateFields.join(', ')}
        WHERE id = $1
        RETURNING id, title, description, status, assignee, organization_id, created_at, updated_at
      `, values);
      
      if (result.rows.length === 0) {
        console.log(`   Work order ${id} not found for org ${orgId}`);
        return res.status(404).json({
          success: false,
          error: 'Work order not found'
        });
      }
      
      console.log(`   Updated work order ${id} for org ${orgId}`);
      res.json({
        success: true,
        data: result.rows[0]
      });
      
    } catch (error) {
      console.error('Database error:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to update work order'
      });
    } finally {
      client.release();
    }
  } else {
    // Fallback to in-memory data
    const workOrderIndex = workOrders.findIndex(wo => wo.id === id && wo.organization_id === orgId);
    
    if (workOrderIndex === -1) {
      console.log(`   Work order ${id} not found for org ${orgId} (in-memory)`);
      return res.status(404).json({
        success: false,
        error: 'Work order not found'
      });
    }
    
    const workOrder = workOrders[workOrderIndex];
    
    // Update allowed fields
    if (updates.status) workOrder.status = updates.status;
    if (updates.assignee !== undefined) workOrder.assignee = updates.assignee;
    if (updates.title) workOrder.title = updates.title;
    if (updates.description !== undefined) workOrder.description = updates.description;
    
    workOrder.updated_at = new Date().toISOString();
    workOrders[workOrderIndex] = workOrder;
    
    console.log(`   Updated work order ${id} for org ${orgId} (in-memory)`);
    res.json({
      success: true,
      data: workOrder
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    database: useDatabase ? 'connected' : 'in-memory',
    timestamp: new Date().toISOString()
  });
});

// Initialize and start server
async function start() {
  await initializeDatabase();
  
  app.listen(port, () => {
    console.log(`🚀 Hunters Run API server running on http://localhost:${port}`);
    console.log(`📝 Work Orders endpoint: http://localhost:${port}/api/v1/work-orders`);
    console.log(`🛡️  RLS Security: ${useDatabase ? 'ENABLED (PostgreSQL)' : 'SIMULATED (in-memory)'}`);
    console.log(`📊 Data source: ${useDatabase ? 'PostgreSQL hr.work_orders table' : 'In-memory demo data'}`);
    console.log(`🎯 Ready for security testing!`);
    console.log(`📋 Required header: x-org-id (UUID format)`);
  });
}

start().catch(console.error);