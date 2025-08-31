// === DEMO SLICE: Work Orders List Component ===
import React, { useState, useEffect } from 'react';
import './WorkOrdersList.css';

interface WorkOrder {
  id: string;
  title: string;
  description: string;
  status: string;
  assignee?: string;
  created_at: string;
  updated_at: string;
}

interface ApiResponse {
  success: boolean;
  data?: WorkOrder[];
  error?: string;
}

const WorkOrdersList: React.FC = () => {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    fetchWorkOrders();
  }, []);

  const fetchWorkOrders = async () => {
    try {
      const response = await fetch('/api/v1/work-orders');
      const result: ApiResponse = await response.json();
      
      if (result.success) {
        setWorkOrders(result.data || []);
      } else {
        console.error('Failed to fetch work orders:', result.error);
      }
    } catch (error) {
      console.error('Error fetching work orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateWorkOrder = async (id: string, updates: Partial<WorkOrder>) => {
    try {
      const response = await fetch(`/api/v1/work-orders/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `update-${id}-${Date.now()}`
        },
        body: JSON.stringify(updates)
      });
      
      const result: ApiResponse = await response.json();
      if (result.success) {
        fetchWorkOrders(); // Refresh list
        if (selectedOrder?.id === id) {
          setSelectedOrder(result.data as WorkOrder);
        }
      }
    } catch (error) {
      console.error('Error updating work order:', error);
    }
  };

  const createWorkOrder = async (title: string, description: string) => {
    try {
      const response = await fetch('/api/v1/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, property_id: 1 })
      });
      
      const result: ApiResponse = await response.json();
      if (result.success) {
        fetchWorkOrders();
        setShowCreateModal(false);
      }
    } catch (error) {
      console.error('Error creating work order:', error);
    }
  };

  if (loading) return <div className="loading">Loading work orders…</div>;

  return (
    <div className="work-orders-container">
      <div className="work-orders-header">
        <h1>Work Orders</h1>
        <button
          className="btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          + New Work Order
        </button>
      </div>
      
      <div className="work-orders-grid">
        <div className="work-orders-list">
          {workOrders.length === 0 ? (
            <div className="empty-state">
              <h3>No work orders yet</h3>
              <p>Create your first work order to get started</p>
            </div>
          ) : (
            workOrders.map(order => (
              <div 
                key={order.id} 
                className={`work-order-card ${selectedOrder?.id === order.id ? 'selected' : ''}`}
                onClick={() => setSelectedOrder(order)}
              >
                <div className="work-order-title">{order.title}</div>
                <div className="work-order-status">
                  <span className={`status-badge status-${order.status.toLowerCase()}`}>
                    {order.status}
                  </span>
                </div>
                <div className="work-order-meta">
                  Created {new Date(order.created_at).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>

        {selectedOrder && (
          <div className="work-order-detail">
            <div className="detail-header">
              <h2>{selectedOrder.title}</h2>
              <button 
                className="close-btn"
                onClick={() => setSelectedOrder(null)}
              >
                ×
              </button>
            </div>
            
            <div className="detail-content">
              <div className="detail-section">
                <label>Status</label>
                <select 
                  value={selectedOrder.status}
                  onChange={(e) => updateWorkOrder(selectedOrder.id, { status: e.target.value })}
                >
                  <option value="SUBMITTED">Submitted</option>
                  <option value="ASSIGNED">Assigned</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>

              <div className="detail-section">
                <label>Assignee</label>
                <input 
                  type="text"
                  placeholder="Assign to..."
                  value={selectedOrder.assignee || ''}
                  onChange={(e) => updateWorkOrder(selectedOrder.id, { assignee: e.target.value })}
                />
              </div>

              <div className="detail-section">
                <label>Description</label>
                <p>{selectedOrder.description}</p>
              </div>

              <div className="timeline">
                <h3>Status Timeline</h3>
                <div className="timeline-item">
                  <span className="timeline-status">Created</span>
                  <span className="timeline-date">
                    {new Date(selectedOrder.created_at).toLocaleString()}
                  </span>
                </div>
                {selectedOrder.updated_at !== selectedOrder.created_at && (
                  <div className="timeline-item">
                    <span className="timeline-status">Updated</span>
                    <span className="timeline-date">
                      {new Date(selectedOrder.updated_at).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateWorkOrderModal 
          onCreate={createWorkOrder}
          onCancel={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
};

const CreateWorkOrderModal: React.FC<{
  onCreate: (title: string, description: string) => void;
  onCancel: () => void;
}> = ({ onCreate, onCancel }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onCreate(title.trim(), description.trim());
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>New Work Order</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              required
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional details…"
              rows={3}
            />
          </div>
          <div className="form-actions">
            <button type="button" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn-primary">Create Work Order</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WorkOrdersList;