import React from 'react';
import './photos-premium.css';

export const PhotoGallerySkeleton: React.FC = () => {
  return (
    <div className="photo-gallery-skeleton">
      {[0, 1, 2].map(section => (
        <div key={section} className="photo-section skeleton-section">
          <div className="section-header">
            <div className="skeleton-loader" style={{ width: '150px', height: '24px', borderRadius: '4px' }}></div>
            <div className="skeleton-loader" style={{ width: '30px', height: '20px', borderRadius: '10px' }}></div>
          </div>
          <div className="photo-grid">
            {[0, 1, 2, 3].map(item => (
              <div 
                key={item} 
                className="skeleton-loader photo-skeleton"
                style={{ 
                  aspectRatio: '4/3',
                  borderRadius: '12px',
                  animation: `shimmer 2s infinite, fadeInUp 0.5s ease-out ${item * 0.1}s both`
                }}
              ></div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export const LoadingDots: React.FC = () => {
  return (
    <div className="loading-dots">
      <span></span>
      <span></span>
      <span></span>
    </div>
  );
};

export const UploadProgressIndicator: React.FC<{ progress: number }> = ({ progress }) => {
  return (
    <div className="upload-progress-indicator">
      <div className="progress-ring">
        <svg width="60" height="60">
          <circle
            cx="30"
            cy="30"
            r="25"
            stroke="#e5e7eb"
            strokeWidth="4"
            fill="none"
          />
          <circle
            cx="30"
            cy="30"
            r="25"
            stroke="url(#gradient)"
            strokeWidth="4"
            fill="none"
            strokeDasharray={`${2 * Math.PI * 25}`}
            strokeDashoffset={`${2 * Math.PI * 25 * (1 - progress / 100)}`}
            strokeLinecap="round"
            transform="rotate(-90 30 30)"
            style={{
              transition: 'stroke-dashoffset 0.3s ease'
            }}
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4f46e5" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
        </svg>
        <div className="progress-text">{progress}%</div>
      </div>
    </div>
  );
};