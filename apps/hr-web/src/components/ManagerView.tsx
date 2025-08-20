import React, { useState, useEffect } from 'react';
import { RoleSwitcher } from './RoleSwitcher';
import { StatusChip } from './StatusChip';
import { AuditVerifyModal } from './AuditVerifyModal';

interface WorkOrder {
  id: string;
  ticketId: string;
  title: string;
  description: string;
  status: 'new' | 'triaged' | 'assigned' | 'in_progress' | 'completed' | 'closed' | 'reopened';
  createdAt: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  assignedTechId?: string;
  assignedTechName?: string;
}

export function ManagerView() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([
    // Sample data for demo
    {
      id: 'wo-demo-1',
      ticketId: 'WO-2025-0001',
      title: 'Bathroom sink leaking',
      description: 'Water dripping from under sink, making puddle on floor',
      status: 'new',
      createdAt: new Date().toISOString(),
      priority: 'normal'
    },
    {
      id: 'wo-demo-2',
      ticketId: 'WO-2025-0002',
      title: 'Air conditioning not working',
      description: 'Unit not cooling, making loud noise',
      status: 'assigned',
      createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      priority: 'high',
      assignedTechId: '00000000-0000-4000-8000-000000000005',
      assignedTechName: 'Mike Johnson'
    }
  ]);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditWorkOrderId, setAuditWorkOrderId] = useState<string | null>(null);

  const availableTechnicians = [
    { id: '00000000-0000-4000-8000-000000000005', name: 'Mike Johnson' },
    { id: '00000000-0000-4000-8000-000000000006', name: 'Sarah Williams' },
    { id: '00000000-0000-4000-8000-000000000007', name: 'David Chen' }
  ];

  const handleStatusChange = async (workOrderId: string, newStatus: WorkOrder['status']) => {
    try {
      // Mock API call - in real implementation would call the backend
      const response = await fetch(`/api/maintenance/work-orders/${workOrderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': '00000000-0000-4000-8000-000000000001'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        setWorkOrders(prev => prev.map(wo => 
          wo.id === workOrderId ? { ...wo, status: newStatus } : wo
        ));
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      // For demo purposes, still update locally
      setWorkOrders(prev => prev.map(wo => 
        wo.id === workOrderId ? { ...wo, status: newStatus } : wo
      ));
    }
  };

  const handleAssignTechnician = async (workOrderId: string, techId: string) => {
    const tech = availableTechnicians.find(t => t.id === techId);
    if (!tech) return;

    try {
      // Mock API call
      const response = await fetch(`/api/maintenance/work-orders/${workOrderId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': '00000000-0000-4000-8000-000000000001'
        },
        body: JSON.stringify({ technicianId: techId })
      });

      if (response.ok) {
        setWorkOrders(prev => prev.map(wo => 
          wo.id === workOrderId 
            ? { 
                ...wo, 
                status: 'assigned',
                assignedTechId: techId,
                assignedTechName: tech.name
              } 
            : wo
        ));
      }
    } catch (error) {
      console.error('Failed to assign technician:', error);
      // For demo purposes, still update locally
      setWorkOrders(prev => prev.map(wo => 
        wo.id === workOrderId 
          ? { 
              ...wo, 
              status: 'assigned',
              assignedTechId: techId,
              assignedTechName: tech.name
            } 
          : wo
      ));
    }
  };

  const handleAuditVerify = (workOrderId: string) => {
    setAuditWorkOrderId(workOrderId);
    setShowAuditModal(true);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'normal': return 'text-blue-600 bg-blue-100';
      case 'low': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="page-transition p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Manager Dashboard</h1>
        <RoleSwitcher className="role-switch" />
      </div>

      {/* Status Legend */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Status Legend</h2>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <StatusChip status="new" />
            <span className="text-sm text-gray-600">New</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusChip status="triaged" />
            <span className="text-sm text-gray-600">Triaged</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusChip status="assigned" />
            <span className="text-sm text-gray-600">Assigned</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusChip status="in_progress" />
            <span className="text-sm text-gray-600">In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusChip status="completed" />
            <span className="text-sm text-gray-600">Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusChip status="closed" />
            <span className="text-sm text-gray-600">Closed</span>
          </div>
        </div>
      </div>

      {/* Work Orders List */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Work Orders</h2>
        
        {workOrders.length === 0 ? (
          <p className="text-gray-500 italic">No work orders found.</p>
        ) : (
          <div className="space-y-4">
            {workOrders.map((workOrder) => (
              <div key={workOrder.id} className="card-hover border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-medium text-lg">{workOrder.title}</h3>
                      <StatusChip status={workOrder.status} />
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(workOrder.priority)}`}>
                        {workOrder.priority.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 font-mono mb-2">
                      Ticket ID: <span className="font-bold">{workOrder.ticketId}</span>
                    </p>
                    {workOrder.description && (
                      <p className="text-gray-700 mb-2">{workOrder.description}</p>
                    )}
                    {workOrder.assignedTechName && (
                      <p className="text-sm text-blue-600">
                        Assigned to: <strong>{workOrder.assignedTechName}</strong>
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    {/* Status Update Buttons */}
                    {workOrder.status === 'new' && (
                      <button
                        onClick={() => handleStatusChange(workOrder.id, 'triaged')}
                        className="hover-scale px-3 py-1 bg-yellow-500 text-white text-sm rounded"
                      >
                        Triage
                      </button>
                    )}
                    
                    {workOrder.status === 'triaged' && (
                      <select
                        onChange={(e) => handleAssignTechnician(workOrder.id, e.target.value)}
                        className="form-field px-3 py-1 text-sm border rounded"
                        defaultValue=""
                      >
                        <option value="" disabled>Assign Technician</option>
                        {availableTechnicians.map(tech => (
                          <option key={tech.id} value={tech.id}>{tech.name}</option>
                        ))}
                      </select>
                    )}

                    {workOrder.status === 'assigned' && (
                      <button
                        onClick={() => handleStatusChange(workOrder.id, 'in_progress')}
                        className="hover-scale px-3 py-1 bg-blue-500 text-white text-sm rounded"
                      >
                        Start Work
                      </button>
                    )}

                    {workOrder.status === 'in_progress' && (
                      <button
                        onClick={() => handleStatusChange(workOrder.id, 'completed')}
                        className="hover-scale px-3 py-1 bg-green-500 text-white text-sm rounded"
                      >
                        Mark Complete
                      </button>
                    )}

                    {workOrder.status === 'completed' && (
                      <>
                        <button
                          onClick={() => handleStatusChange(workOrder.id, 'closed')}
                          className="hover-scale px-3 py-1 bg-gray-600 text-white text-sm rounded"
                        >
                          Close
                        </button>
                        <button
                          onClick={() => handleAuditVerify(workOrder.id)}
                          className="hover-scale px-3 py-1 bg-purple-600 text-white text-sm rounded"
                        >
                          Audit Verify
                        </button>
                      </>
                    )}

                    {workOrder.status === 'closed' && (
                      <button
                        onClick={() => handleAuditVerify(workOrder.id)}
                        className="hover-scale px-3 py-1 bg-purple-600 text-white text-sm rounded"
                      >
                        View Audit
                      </button>
                    )}
                  </div>

                  <span className="text-sm text-gray-500">
                    Created: {new Date(workOrder.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audit Modal */}
      {showAuditModal && auditWorkOrderId && (
        <AuditVerifyModal
          workOrderId={auditWorkOrderId}
          onClose={() => {
            setShowAuditModal(false);
            setAuditWorkOrderId(null);
          }}
        />
      )}
    </div>
  );
}