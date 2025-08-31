import React, { useState, useEffect } from 'react';
import { mockPhotoService, Photo } from './mockPhotoService';
import { PhotoUploader } from './PhotoUploader';
import './photos.css';

interface RolePhotoPanelProps {
  workOrderId: string;
  userRole: 'TENANT' | 'MANAGER' | 'TECH';
  currentStatus: string;
  onStatusChange?: (newStatus: string) => void;
  onPhotoAdded?: () => void;
}

export const RolePhotoPanel: React.FC<RolePhotoPanelProps> = ({
  workOrderId,
  userRole,
  currentStatus,
  onStatusChange,
  onPhotoAdded
}) => {
  const [photoCounts, setPhotoCounts] = useState({ before: 0, during: 0, after: 0 });
  const [showUploader, setShowUploader] = useState<Photo['kind'] | null>(null);

  useEffect(() => {
    loadPhotoCounts();
  }, [workOrderId]);

  const loadPhotoCounts = async () => {
    const counts = mockPhotoService.getPhotoCount(workOrderId);
    setPhotoCounts(counts);
  };

  const handlePhotoAdded = (photo: Photo) => {
    loadPhotoCounts();
    setShowUploader(null);
    onPhotoAdded?.();
  };

  const canStartWork = photoCounts.before > 0;
  const canComplete = photoCounts.during > 0 && photoCounts.after > 0;

  if (userRole === 'TENANT') {
    return (
      <div className="role-photo-panel tenant">
        <div className="panel-header">
          <h3>Add Photos</h3>
          <div className="help-banner">
            📸 Photos help us fix it faster. Add up to 5 quick shots.
          </div>
        </div>

        <div className="photo-tips">
          <strong>Tips:</strong> Start with a wide shot, then close-up. Good light helps.
        </div>

        {showUploader ? (
          <PhotoUploader
            workOrderId={workOrderId}
            kind="TENANT_SUBMITTED"
            role="TENANT"
            maxFiles={5}
            onUploadComplete={handlePhotoAdded}
            helpText="Show us what needs fixing"
          />
        ) : (
          <button 
            className="btn-primary add-photos-btn"
            onClick={() => setShowUploader('TENANT_SUBMITTED')}
          >
            📷 Add Photos
          </button>
        )}
      </div>
    );
  }

  if (userRole === 'MANAGER') {
    return (
      <div className="role-photo-panel manager">
        <div className="panel-header">
          <h3>Manager Actions</h3>
        </div>

        {showUploader ? (
          <PhotoUploader
            workOrderId={workOrderId}
            kind="MANAGER_NOTE"
            role="MANAGER"
            maxFiles={3}
            onUploadComplete={handlePhotoAdded}
            helpText="Add context or additional information"
          />
        ) : (
          <button 
            className="btn-secondary add-context-btn"
            onClick={() => setShowUploader('MANAGER_NOTE')}
          >
            📝 Add Context Photo
          </button>
        )}
      </div>
    );
  }

  if (userRole === 'TECH') {
    return (
      <div className="role-photo-panel tech">
        <div className="panel-header">
          <h3>Technician Actions</h3>
        </div>

        <div className="tech-photo-actions">
          <div className="photo-requirements">
            <div className={`requirement ${photoCounts.before > 0 ? 'met' : 'unmet'}`}>
              {photoCounts.before > 0 ? '✅' : '⏳'} Before photos ({photoCounts.before})
            </div>
            <div className={`requirement ${photoCounts.during > 0 ? 'met' : 'unmet'}`}>
              {photoCounts.during > 0 ? '✅' : '⏳'} During photos ({photoCounts.during})
            </div>
            <div className={`requirement ${photoCounts.after > 0 ? 'met' : 'unmet'}`}>
              {photoCounts.after > 0 ? '✅' : '⏳'} After photos ({photoCounts.after})
            </div>
          </div>

          <div className="photo-action-buttons">
            {showUploader ? (
              <PhotoUploader
                workOrderId={workOrderId}
                kind={showUploader}
                role="TECH"
                maxFiles={3}
                onUploadComplete={handlePhotoAdded}
                helpText={`Add ${showUploader.split('_')[1].toLowerCase()} photos`}
              />
            ) : (
              <>
                <button 
                  className="btn-outline"
                  onClick={() => setShowUploader('TECH_BEFORE')}
                >
                  📷 Add Before
                </button>
                <button 
                  className="btn-outline"
                  onClick={() => setShowUploader('TECH_DURING')}
                >
                  📷 Add During
                </button>
                <button 
                  className="btn-outline"
                  onClick={() => setShowUploader('TECH_AFTER')}
                >
                  📷 Add After
                </button>
              </>
            )}
          </div>

          <div className="status-actions">
            <button
              className={`btn-status ${canStartWork ? 'btn-primary' : 'btn-disabled'}`}
              disabled={!canStartWork}
              onClick={() => canStartWork && onStatusChange?.('IN_PROGRESS')}
              title={!canStartWork ? 'Add before photos first' : 'Start work'}
            >
              🚀 Start Work
            </button>
            
            <button
              className={`btn-status ${canComplete ? 'btn-success' : 'btn-disabled'}`}
              disabled={!canComplete}
              onClick={() => canComplete && onStatusChange?.('COMPLETED')}
              title={!canComplete ? 'Add during and after photos first' : 'Mark complete'}
            >
              ✅ Complete
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};