import React, { useState, useRef } from 'react';
import { mockPhotoService, Photo } from './mockPhotoService';
import './photos.css';

interface PhotoUploaderProps {
  workOrderId: string;
  kind: Photo['kind'];
  role: Photo['role'];
  maxFiles?: number;
  onUploadComplete?: (photo: Photo) => void;
  disabled?: boolean;
  helpText?: string;
}

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  workOrderId,
  kind,
  role,
  maxFiles = 5,
  onUploadComplete,
  disabled = false,
  helpText
}) => {
  const [uploading, setUploading] = useState<{[key: string]: number}>({});
  const [previews, setPreviews] = useState<{file: File; url: string; id: string}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    handleFiles(files);
  };

  const handleFiles = (files: File[]) => {
    if (disabled) return;

    const remaining = maxFiles - previews.length;
    const filesToProcess = files.slice(0, remaining);

    filesToProcess.forEach(file => {
      const id = `preview-${Date.now()}-${Math.random()}`;
      const url = URL.createObjectURL(file);
      
      setPreviews(prev => [...prev, { file, url, id }]);
      uploadFile(file, id);
    });
  };

  const uploadFile = async (file: File, previewId: string) => {
    try {
      setUploading(prev => ({ ...prev, [previewId]: 0 }));

      // Simulate smooth progress with variable speed
      const progressSteps = [0, 15, 30, 50, 70, 85, 95, 100];
      const delays = [200, 300, 400, 300, 200, 150, 100, 200];
      
      for (let i = 0; i < progressSteps.length; i++) {
        setUploading(prev => ({ ...prev, [previewId]: progressSteps[i] }));
        await new Promise(resolve => setTimeout(resolve, delays[i]));
      }

      // Get upload URL with realistic delay
      const { uploadUrl, storageKey } = await mockPhotoService.requestUpload(kind);
      
      // Upload file with realistic processing time
      const photoUrl = await mockPhotoService.upload(uploadUrl, file);
      
      // Save metadata
      const photo = await mockPhotoService.saveMeta(workOrderId, kind, storageKey, role, photoUrl);
      
      // Show success state briefly
      setUploading(prev => ({ ...prev, [previewId]: 100 }));
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Complete upload
      setUploading(prev => {
        const updated = { ...prev };
        delete updated[previewId];
        return updated;
      });
      
      onUploadComplete?.(photo);
      
    } catch (error) {
      console.error('Upload failed:', error);
      // Show error state
      setUploading(prev => ({ ...prev, [previewId]: -1 }));
      setTimeout(() => {
        setUploading(prev => {
          const updated = { ...prev };
          delete updated[previewId];
          return updated;
        });
      }, 2000);
    }
  };

  const removePreview = (id: string) => {
    setPreviews(prev => prev.filter(p => p.id !== id));
    setUploading(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
  };

  const openFileDialog = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="photo-uploader">
      {helpText && (
        <div className="upload-help">
          📸 {helpText}
        </div>
      )}

      <div 
        className={`upload-area ${disabled ? 'disabled' : ''}`}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={openFileDialog}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple={maxFiles > 1}
          onChange={(e) => handleFiles(Array.from(e.target.files || []))}
          style={{ display: 'none' }}
          disabled={disabled}
        />
        
        <div className="upload-content">
          <div className="upload-icon">📷</div>
          <div className="upload-text">
            Drag photos here or <span className="upload-link">browse</span>
          </div>
          <div className="upload-sub">Up to {maxFiles} photos • JPG, PNG</div>
        </div>
      </div>

      {previews.length > 0 && (
        <div className="preview-grid">
          {previews.map(preview => (
            <div key={preview.id} className="preview-item">
              <img src={preview.url} alt="Preview" className="preview-image" />
              
              {uploading[preview.id] !== undefined ? (
                <div className="preview-progress">
                  {uploading[preview.id] === -1 ? (
                    <>
                      <div className="progress-error">Upload failed</div>
                      <span className="progress-text error">❌ Error</span>
                    </>
                  ) : uploading[preview.id] === 100 ? (
                    <>
                      <div className="progress-success">Upload complete</div>
                      <span className="progress-text success">✅ Done</span>
                    </>
                  ) : (
                    <>
                      <div 
                        className="progress-bar"
                        style={{ width: `${uploading[preview.id]}%` }}
                      />
                      <span className="progress-text">{uploading[preview.id]}%</span>
                    </>
                  )}
                </div>
              ) : (
                <button 
                  className="preview-remove"
                  onClick={() => removePreview(preview.id)}
                  aria-label="Remove photo"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};