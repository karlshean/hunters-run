// === DEMO SLICE: Work Orders List Component ===
import React, { useState, useEffect } from 'react';
import { PhotoUploader } from '../../features/photos/PhotoUploader';
import { PhotoGallery } from '../../features/photos/PhotoGallery';
import { RolePhotoPanel } from '../../features/photos/RolePhotoPanel';
import '../../features/photos/photos.css';
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
      {/* Demo Navigation - Always show for demo */}
      {true && (
        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '16px'
        }}>
          <div style={{
            background: '#f0f9ff',
            border: '1px solid #0ea5e9',
            borderRadius: '8px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flex: 1
          }}>
            <div>
              <strong>📸 Photo Demo Available!</strong> 
              <span style={{ marginLeft: '8px', color: '#6b7280' }}>
                Professional photo workflow
              </span>
            </div>
            <button
              onClick={() => window.location.href = '/demo/photos'}
              style={{
                background: '#0ea5e9',
                color: 'white',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              View Demo
            </button>
          </div>
          
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: '1px solid #667eea',
            borderRadius: '8px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flex: 1
          }}>
            <div>
              <strong style={{ color: 'white' }}>✨ Social Experience!</strong> 
              <span style={{ marginLeft: '8px', color: 'rgba(255,255,255,0.8)' }}>
                Instagram/Snapchat style
              </span>
            </div>
            <button
              onClick={() => window.location.href = '/demo/social'}
              style={{
                background: 'white',
                color: '#667eea',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              Try Social
            </button>
          </div>
        </div>
      )}
      
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

              {/* Photo Section - Feature Flagged */}
              {process.env.FEATURE_DEMO_PHOTOS_UI === 'true' && (
                <div className="detail-section photos-section">
                  <h3>Photos</h3>
                  <PhotoGallery workOrderId={selectedOrder.id} />
                  <div style={{ marginTop: '16px' }}>
                    <RolePhotoPanel
                      workOrderId={selectedOrder.id}
                      userRole="TENANT"
                      currentStatus={selectedOrder.status}
                      onStatusChange={(newStatus) => updateWorkOrder(selectedOrder.id, { status: newStatus })}
                    />
                  </div>
                </div>
              )}

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
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onCreate(title.trim(), description.trim());
    }
  };

  const isPhotoFeatureEnabled = process.env.FEATURE_DEMO_PHOTOS_UI === 'true';

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: showPhotoUpload ? '600px' : '400px' }}>
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
          
          {/* Photo Upload Section - Feature Flagged */}
          {isPhotoFeatureEnabled && (
            <div className="form-group">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <label>Add Photos</label>
                <button
                  type="button"
                  onClick={() => setShowPhotoUpload(!showPhotoUpload)}
                  style={{
                    background: 'none',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  {showPhotoUpload ? 'Hide' : 'Show'} Photo Upload
                </button>
              </div>
              
              {showPhotoUpload && (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ color: '#6b7280', fontSize: '14px', marginBottom: '12px' }}>
                    📸 Adding photos helps us understand the issue better and speeds up repairs!
                  </div>
                  <PhotoUploader
                    workOrderId={`temp-${Date.now()}`} // Temporary ID for demo
                    kind="TENANT_SUBMITTED"
                    role="TENANT"
                    maxFiles={3}
                    helpText="Show us what needs fixing"
                    onUploadComplete={() => {}}
                  />
                </div>
              )}
            </div>
          )}
          
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