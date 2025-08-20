import React, { useState } from 'react';
import { RoleSwitcher } from './RoleSwitcher';
import { StatusChip } from './StatusChip';

interface WorkOrder {
  id: string;
  ticketId: string;
  title: string;
  description: string;
  status: 'new' | 'triaged' | 'assigned' | 'in_progress' | 'completed' | 'closed' | 'reopened';
  createdAt: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

export function TenantView() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setSubmitSuccess(null);

    const formData = new FormData(e.currentTarget);
    const file = formData.get('photo') as File;
    
    if (!file) {
      alert('Please select a photo');
      setLoading(false);
      return;
    }

    try {
      // Upload photo first
      const photoFormData = new FormData();
      photoFormData.append('photo', file);
      
      const photoResponse = await fetch('/api/maintenance/photo', {
        method: 'POST',
        headers: {
          'x-org-id': '00000000-0000-4000-8000-000000000001'
        },
        body: photoFormData
      });
      
      if (!photoResponse.ok) {
        throw new Error('Photo upload failed');
      }
      
      const photoResult = await photoResponse.json();
      
      // Create work order with photo key
      const workOrderData = {
        unitId: '00000000-0000-4000-8000-000000000003',
        tenantId: '00000000-0000-4000-8000-000000000004',
        title: formData.get('title') as string,
        description: formData.get('description') as string,
        priority: formData.get('priority') as string || 'normal',
        photoKey: photoResult.photoKey
      };
      
      const workOrderResponse = await fetch('/api/maintenance/work-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': '00000000-0000-4000-8000-000000000001'
        },
        body: JSON.stringify(workOrderData)
      });
      
      if (!workOrderResponse.ok) {
        throw new Error('Work order creation failed');
      }
      
      const workOrderResult = await workOrderResponse.json();
      
      // Show success with ticket ID
      setSubmitSuccess(`Work order created! Ticket ID: ${workOrderResult.ticketId}`);
      
      // Add to local state for display
      setWorkOrders(prev => [{
        id: workOrderResult.id,
        ticketId: workOrderResult.ticketId,
        title: workOrderData.title,
        description: workOrderData.description,
        status: 'new',
        createdAt: new Date().toISOString(),
        priority: workOrderData.priority as any
      }, ...prev]);
      
      // Reset form
      (e.target as HTMLFormElement).reset();
      
    } catch (error) {
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-transition p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Tenant Portal</h1>
        <RoleSwitcher className="role-switch" />
      </div>

      {/* Submit Work Order Form */}
      <div className="card-hover bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Submit Maintenance Request</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="photo" className="block text-sm font-medium text-gray-700 mb-2">
              Photo Evidence *
            </label>
            <input
              type="file"
              id="photo"
              name="photo"
              accept="image/*"
              className="form-field w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Issue Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              className="form-field w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Bathroom sink leaking"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              className="form-field w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Please describe the issue in detail..."
            />
          </div>

          <div>
            <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
              Priority
            </label>
            <select
              id="priority"
              name="priority"
              className="form-field w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="hover-scale w-full bg-blue-600 text-white py-2 px-4 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <div className="spinner w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                Submitting...
              </span>
            ) : (
              'Submit Work Order'
            )}
          </button>
        </form>

        {submitSuccess && (
          <div className="success-toast mt-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-md">
            ✅ {submitSuccess}
          </div>
        )}
      </div>

      {/* My Work Orders */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">My Work Orders</h2>
        
        {workOrders.length === 0 ? (
          <p className="text-gray-500 italic">No work orders submitted yet.</p>
        ) : (
          <div className="space-y-4">
            {workOrders.map((workOrder) => (
              <div key={workOrder.id} className="card-hover border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-medium text-lg">{workOrder.title}</h3>
                    <p className="text-sm text-gray-600 font-mono">
                      Ticket ID: <span className="font-bold">{workOrder.ticketId}</span>
                    </p>
                  </div>
                  <StatusChip status={workOrder.status} />
                </div>
                
                {workOrder.description && (
                  <p className="text-gray-700 mb-2">{workOrder.description}</p>
                )}
                
                <div className="flex justify-between items-center text-sm text-gray-500">
                  <span>Priority: {workOrder.priority.toUpperCase()}</span>
                  <span>Submitted: {new Date(workOrder.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}