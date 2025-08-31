import React, { useEffect, useCallback } from 'react';
import { Photo } from './mockPhotoService';
import './photos.css';
import './photos-premium.css';

interface LightboxProps {
  photos: Photo[];
  currentPhoto: Photo;
  onClose: () => void;
  onNavigate: (photo: Photo) => void;
}

export const Lightbox: React.FC<LightboxProps> = ({
  photos,
  currentPhoto,
  onClose,
  onNavigate
}) => {
  const currentIndex = photos.findIndex(p => p.id === currentPhoto.id);

  const goNext = useCallback(() => {
    if (currentIndex < photos.length - 1) {
      onNavigate(photos[currentIndex + 1]);
    }
  }, [currentIndex, photos, onNavigate]);

  const goPrevious = useCallback(() => {
    if (currentIndex > 0) {
      onNavigate(photos[currentIndex - 1]);
    }
  }, [currentIndex, photos, onNavigate]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowRight') goNext();
    if (e.key === 'ArrowLeft') goPrevious();
  }, [onClose, goNext, goPrevious]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  const formatKind = (kind: string) => {
    return kind.replace('_', ' ').toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-container" onClick={e => e.stopPropagation()}>
        <button 
          className="lightbox-close"
          onClick={onClose}
          aria-label="Close lightbox"
        >
          ×
        </button>

        <div className="lightbox-content">
          {currentIndex > 0 && (
            <button 
              className="lightbox-nav lightbox-prev"
              onClick={goPrevious}
              aria-label="Previous photo"
            >
              ‹
            </button>
          )}

          <div className="lightbox-image-container">
            <img 
              src={currentPhoto.url} 
              alt={formatKind(currentPhoto.kind)}
              className="lightbox-image"
            />
          </div>

          {currentIndex < photos.length - 1 && (
            <button 
              className="lightbox-nav lightbox-next"
              onClick={goNext}
              aria-label="Next photo"
            >
              ›
            </button>
          )}
        </div>

        <div className="lightbox-caption">
          <div className="caption-title">{formatKind(currentPhoto.kind)}</div>
          <div className="caption-meta">
            {new Date(currentPhoto.createdAt).toLocaleString()} • 
            Photo {currentIndex + 1} of {photos.length}
          </div>
        </div>
      </div>
    </div>
  );
};