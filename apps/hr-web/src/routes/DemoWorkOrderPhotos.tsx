import React, { useState } from 'react';
import { PhotoUploader } from '../features/photos/PhotoUploader';
import { PhotoGallery } from '../features/photos/PhotoGallery';
import { RolePhotoPanel } from '../features/photos/RolePhotoPanel';
import '../features/photos/photos.css';

export const DemoWorkOrderPhotos: React.FC = () => {
  const [currentRole, setCurrentRole] = useState<'TENANT' | 'MANAGER' | 'TECH'>('TENANT');
  const [workOrderStatus, setWorkOrderStatus] = useState('SUBMITTED');
  const [refreshKey, setRefreshKey] = useState(0);

  const workOrderId = 'wo-demo-1';

  const handleStatusChange = (newStatus: string) => {
    setWorkOrderStatus(newStatus);
    alert(`Work order status changed to: ${newStatus}`);
  };

  const handlePhotoAdded = () => {
    // Force refresh of gallery
    setRefreshKey(prev => prev + 1);
  };

  const roleStyles = {
    TENANT: { background: '#eff6ff', border: '2px solid #3b82f6' },
    MANAGER: { background: '#f0fdf4', border: '2px solid #10b981' },
    TECH: { background: '#fef3c7', border: '2px solid #f59e0b' }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <h1>Photo-First Maintenance Demo</h1>
        <p>Demo the complete photo workflow for different user roles</p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '16px' }}>
          {(['TENANT', 'MANAGER', 'TECH'] as const).map(role => (
            <button
              key={role}
              onClick={() => setCurrentRole(role)}
              style={{
                padding: '8px 16px',
                border: currentRole === role ? '2px solid #4f46e5' : '1px solid #d1d5db',
                background: currentRole === role ? '#4f46e5' : 'white',
                color: currentRole === role ? 'white' : '#374151',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              {role}
            </button>
          ))}
        </div>
        
        <div style={{
          ...roleStyles[currentRole],
          padding: '16px',
          borderRadius: '8px',
          marginTop: '16px',
          fontWeight: '500'
        }}>
          Current Role: {currentRole} | Work Order Status: {workOrderStatus}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '32px' }}>
        <div>
          <h2>Photo Gallery</h2>
          <PhotoGallery 
            key={refreshKey}
            workOrderId={workOrderId} 
          />
        </div>

        <div>
          <h2>Role Panel</h2>
          <RolePhotoPanel
            workOrderId={workOrderId}
            userRole={currentRole}
            currentStatus={workOrderStatus}
            onStatusChange={handleStatusChange}
            onPhotoAdded={handlePhotoAdded}
          />
          
          <div style={{
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '16px',
            marginTop: '16px'
          }}>
            <h4 style={{ margin: '0 0 12px 0' }}>Demo Instructions</h4>
            <div style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.5' }}>
              <p><strong>Tenant:</strong> Add photos during initial request</p>
              <p><strong>Manager:</strong> Add optional context photos</p>
              <p><strong>Tech:</strong> Must add Before/During/After to progress status</p>
              <p><strong>Gallery:</strong> Click photos to open lightbox viewer</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoWorkOrderPhotos;