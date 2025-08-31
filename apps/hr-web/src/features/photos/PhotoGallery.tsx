import React, { useState, useEffect } from 'react';
import { mockPhotoService, PhotoGroups, Photo } from './mockPhotoService';
import { Lightbox } from './Lightbox';
import './photos.css';

interface PhotoGalleryProps {
  workOrderId: string;
  onPhotoClick?: (photo: Photo) => void;
}

export const PhotoGallery: React.FC<PhotoGalleryProps> = ({ workOrderId }) => {
  const [photoGroups, setPhotoGroups] = useState<PhotoGroups>({
    before: [],
    during: [],
    after: [],
    tenant: [],
    manager: []
  });
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);

  useEffect(() => {
    loadPhotos();
  }, [workOrderId]);

  const loadPhotos = async () => {
    const groups = await mockPhotoService.list(workOrderId);
    setPhotoGroups(groups);

    // Flatten for lightbox navigation
    const all = [
      ...groups.before,
      ...groups.during, 
      ...groups.after,
      ...groups.tenant,
      ...groups.manager
    ];
    setAllPhotos(all);
  };

  const openLightbox = (photo: Photo) => {
    setLightboxPhoto(photo);
  };

  const PhotoSection: React.FC<{
    title: string;
    photos: Photo[];
    emptyText: string;
    badge?: string;
  }> = ({ title, photos, emptyText, badge }) => (
    <div className="photo-section">
      <div className="section-header">
        <h3>{title}</h3>
        {badge && <span className="photo-count-badge">{badge}</span>}
      </div>

      {photos.length === 0 ? (
        <div className="empty-photos">
          <div className="empty-icon">📷</div>
          <div className="empty-text">{emptyText}</div>
        </div>
      ) : (
        <div className="photo-grid">
          {photos.map(photo => (
            <div 
              key={photo.id}
              className="photo-thumb"
              onClick={() => openLightbox(photo)}
              onKeyDown={(e) => e.key === 'Enter' && openLightbox(photo)}
              tabIndex={0}
              role="button"
              aria-label={`View ${photo.kind} photo`}
            >
              <img src={photo.url} alt={photo.kind} />
              <div className="photo-overlay">
                <span className="photo-time">
                  {new Date(photo.createdAt).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const isEmpty = allPhotos.length === 0;

  if (isEmpty) {
    return (
      <div className="photo-gallery empty">
        <div className="gallery-empty-state">
          <div className="empty-icon">📸</div>
          <h3>No photos yet</h3>
          <p>Add your first photo to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="photo-gallery">
      <PhotoSection
        title="Before Work"
        photos={photoGroups.before}
        emptyText="No before photos yet"
        badge={photoGroups.before.length > 0 ? photoGroups.before.length.toString() : undefined}
      />

      <PhotoSection
        title="During Work"
        photos={photoGroups.during}
        emptyText="No progress photos yet"
        badge={photoGroups.during.length > 0 ? photoGroups.during.length.toString() : undefined}
      />
      
      <PhotoSection
        title="After Work"
        photos={photoGroups.after}
        emptyText="No completion photos yet"
        badge={photoGroups.after.length > 0 ? photoGroups.after.length.toString() : undefined}
      />
      
      <PhotoSection
        title="Tenant Photos"
        photos={photoGroups.tenant}
        emptyText="No tenant photos"
        badge={photoGroups.tenant.length > 0 ? photoGroups.tenant.length.toString() : undefined}
      />
      
      <PhotoSection
        title="Manager Notes"
        photos={photoGroups.manager}
        emptyText="No manager photos"
        badge={photoGroups.manager.length > 0 ? photoGroups.manager.length.toString() : undefined}
      />

      {lightboxPhoto && (
        <Lightbox
          photos={allPhotos}
          currentPhoto={lightboxPhoto}
          onClose={() => setLightboxPhoto(null)}
          onNavigate={setLightboxPhoto}
        />
      )}
    </div>
  );
};