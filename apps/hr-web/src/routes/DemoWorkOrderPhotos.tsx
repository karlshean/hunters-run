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
    TENANT: { 
      background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', 
      border: '2px solid #3b82f6',
      boxShadow: '0 8px 32px rgba(59, 130, 246, 0.15)'
    },
    MANAGER: { 
      background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', 
      border: '2px solid #10b981',
      boxShadow: '0 8px 32px rgba(16, 185, 129, 0.15)'
    },
    TECH: { 
      background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', 
      border: '2px solid #f59e0b',
      boxShadow: '0 8px 32px rgba(245, 158, 11, 0.15)'
    }
  };

  return (
    <div style={{ 
      maxWidth: '1400px', 
      margin: '0 auto', 
      padding: '32px 24px',
      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
      minHeight: '100vh'
    }}>
      <div style={{ 
        marginBottom: '48px', 
        textAlign: 'center',
        padding: '48px 32px',
        background: 'white',
        borderRadius: '24px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
        border: '1px solid rgba(226, 232, 240, 0.8)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '6px',
          background: 'linear-gradient(90deg, #4f46e5 0%, #8b5cf6 50%, #ec4899 100%)'
        }}></div>
        
        <h1 style={{ 
          fontSize: '48px', 
          fontWeight: '800', 
          margin: '0 0 16px 0',
          background: 'linear-gradient(135deg, #1f2937 0%, #4f46e5 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '-0.025em'
        }}>
          📸 Photo-First Maintenance Demo
        </h1>
        <p style={{ 
          fontSize: '20px', 
          color: '#64748b', 
          margin: '0 0 32px 0',
          fontWeight: '500'
        }}>
          Experience the complete photo workflow for different user roles
        </p>

        <div style={{ 
          display: 'flex', 
          gap: '16px', 
          justifyContent: 'center', 
          flexWrap: 'wrap',
          marginBottom: '24px'
        }}>
          {(['TENANT', 'MANAGER', 'TECH'] as const).map(role => (
            <button
              key={role}
              onClick={() => setCurrentRole(role)}
              style={{
                padding: '14px 28px',
                border: currentRole === role ? '2px solid #4f46e5' : '2px solid transparent',
                background: currentRole === role 
                  ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' 
                  : 'linear-gradient(135deg, white 0%, #f8fafc 100%)',
                color: currentRole === role ? 'white' : '#475569',
                borderRadius: '12px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '16px',
                boxShadow: currentRole === role 
                  ? '0 8px 25px rgba(79, 70, 229, 0.4)' 
                  : '0 4px 12px rgba(0, 0, 0, 0.08)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: currentRole === role ? 'translateY(-2px)' : 'translateY(0)',
                letterSpacing: '0.025em'
              }}
            >
              {role}
            </button>
          ))}
        </div>
        
        <div style={{
          ...roleStyles[currentRole],
          padding: '20px 28px',
          borderRadius: '16px',
          fontWeight: '600',
          fontSize: '18px',
          transition: 'all 0.3s ease',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: roleStyles[currentRole].border.replace('2px solid ', ''),
            opacity: 0.8
          }}></div>
          
          <div style={{ position: 'relative', zIndex: 1 }}>
            <strong>Current Role:</strong> {currentRole} | 
            <strong> Status:</strong> {workOrderStatus}
          </div>
        </div>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '2fr 1fr', 
        gap: '48px',
        marginTop: '32px'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '32px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
          border: '1px solid rgba(226, 232, 240, 0.8)'
        }}>
          <h2 style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#1f2937',
            margin: '0 0 32px 0',
            letterSpacing: '-0.025em'
          }}>
            📷 Photo Gallery
          </h2>
          <PhotoGallery 
            key={refreshKey}
            workOrderId={workOrderId} 
          />
        </div>

        <div>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            padding: '32px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            marginBottom: '24px'
          }}>
            <h2 style={{
              fontSize: '28px',
              fontWeight: '700',
              color: '#1f2937',
              margin: '0 0 32px 0',
              letterSpacing: '-0.025em'
            }}>
              🎯 Role Panel
            </h2>
            <RolePhotoPanel
              workOrderId={workOrderId}
              userRole={currentRole}
              currentStatus={workOrderStatus}
              onStatusChange={handleStatusChange}
              onPhotoAdded={handlePhotoAdded}
            />
          </div>
          
          <div style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            borderRadius: '16px',
            padding: '24px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: 'linear-gradient(90deg, #8b5cf6, #ec4899)'
            }}></div>
            
            <h4 style={{ 
              margin: '0 0 20px 0',
              fontSize: '20px',
              fontWeight: '700',
              color: '#1f2937'
            }}>
              💡 Demo Instructions
            </h4>
            <div style={{ 
              fontSize: '15px', 
              color: '#475569', 
              lineHeight: '1.6',
              fontWeight: '500'
            }}>
              <p style={{ margin: '0 0 12px 0' }}>
                <strong style={{ color: '#3b82f6' }}>🏠 Tenant:</strong> Add photos during initial request
              </p>
              <p style={{ margin: '0 0 12px 0' }}>
                <strong style={{ color: '#10b981' }}>👔 Manager:</strong> Add optional context photos
              </p>
              <p style={{ margin: '0 0 12px 0' }}>
                <strong style={{ color: '#f59e0b' }}>🔧 Tech:</strong> Must add Before/During/After to progress status
              </p>
              <p style={{ margin: '0' }}>
                <strong style={{ color: '#8b5cf6' }}>🖼️ Gallery:</strong> Click photos to open lightbox viewer
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoWorkOrderPhotos;