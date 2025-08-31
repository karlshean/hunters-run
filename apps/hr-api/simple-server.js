// Simple Express server for work orders demo
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory data store for demo
let workOrders = [
  {
    id: uuidv4(),
    title: "Fix leaky faucet",
    description: "Kitchen faucet is dripping constantly",
    status: "SUBMITTED",
    assignee: null,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: uuidv4(),
    title: "Replace door lock",
    description: "Front door lock is not working properly",
    status: "ASSIGNED",
    assignee: "John Smith",
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  }
];

// GET /api/v1/work-orders - List work orders
app.get('/api/v1/work-orders', (req, res) => {
  console.log('GET /api/v1/work-orders');
  res.json({
    success: true,
    data: workOrders
  });
});

// GET /api/v1/work-orders/:id - Get work order by ID
app.get('/api/v1/work-orders/:id', (req, res) => {
  console.log(`GET /api/v1/work-orders/${req.params.id}`);
  const workOrder = workOrders.find(wo => wo.id === req.params.id);
  
  if (!workOrder) {
    return res.json({
      success: false,
      error: 'Work order not found'
    });
  }

  res.json({
    success: true,
    data: workOrder
  });
});

// POST /api/v1/work-orders - Create new work order
app.post('/api/v1/work-orders', (req, res) => {
  console.log('POST /api/v1/work-orders', req.body);
  
  const { title, description } = req.body;
  
  if (!title) {
    return res.json({
      success: false,
      error: 'Title is required'
    });
  }

  const newWorkOrder = {
    id: uuidv4(),
    title,
    description: description || '',
    status: 'SUBMITTED',
    assignee: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  workOrders.unshift(newWorkOrder);

  res.json({
    success: true,
    data: newWorkOrder
  });
});

// PATCH /api/v1/work-orders/:id - Update work order
app.patch('/api/v1/work-orders/:id', (req, res) => {
  console.log(`PATCH /api/v1/work-orders/${req.params.id}`, req.body);
  
  const workOrderIndex = workOrders.findIndex(wo => wo.id === req.params.id);
  
  if (workOrderIndex === -1) {
    return res.json({
      success: false,
      error: 'Work order not found'
    });
  }

  const updates = req.body;
  const workOrder = workOrders[workOrderIndex];

  // Update allowed fields
  if (updates.status) workOrder.status = updates.status;
  if (updates.assignee !== undefined) workOrder.assignee = updates.assignee;
  if (updates.title) workOrder.title = updates.title;
  if (updates.description !== undefined) workOrder.description = updates.description;
  
  workOrder.updated_at = new Date().toISOString();

  workOrders[workOrderIndex] = workOrder;

  res.json({
    success: true,
    data: workOrder
  });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Hunters Run API server running on http://localhost:${port}`);
  console.log(`📝 Work Orders endpoint: http://localhost:${port}/api/v1/work-orders`);
  console.log(`📊 Demo data: ${workOrders.length} work orders loaded`);
  console.log(`🎯 Ready for golden path demo!`);
});