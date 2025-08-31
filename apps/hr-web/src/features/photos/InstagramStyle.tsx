import React, { useState, useRef, useEffect } from 'react';
import { Photo } from './mockPhotoService';
import './social-media-style.css';

// Instagram-style story circles for photo categories
export const PhotoStoryBubbles: React.FC<{
  categories: Array<{
    type: string;
    count: number;
    hasNew: boolean;
    icon: string;
    gradient: string;
  }>;
  onCategoryClick: (type: string) => void;
}> = ({ categories, onCategoryClick }) => {
  return (
    <div className="story-bubbles-container">
      <div className="story-bubbles-scroll">
        {categories.map((category, index) => (
          <div
            key={category.type}
            className="story-bubble-wrapper"
            onClick={() => onCategoryClick(category.type)}
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div 
              className={`story-bubble ${category.hasNew ? 'has-new' : ''}`}
              style={{ background: category.gradient }}
            >
              <div className="story-bubble-inner">
                <span className="story-icon">{category.icon}</span>
                {category.count > 0 && (
                  <span className="story-count">{category.count}</span>
                )}
              </div>
            </div>
            <span className="story-label">{category.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Snapchat-style camera-first capture button
export const SnapCameraButton: React.FC<{
  onCapture: () => void;
  isCapturing?: boolean;
}> = ({ onCapture, isCapturing = false }) => {
  const [isPressed, setIsPressed] = useState(false);
  const [showRipple, setShowRipple] = useState(false);

  const handleClick = () => {
    setShowRipple(true);
    onCapture();
    setTimeout(() => setShowRipple(false), 600);
  };

  return (
    <div className="snap-camera-container">
      <button
        className={`snap-camera-button ${isPressed ? 'pressed' : ''} ${isCapturing ? 'capturing' : ''}`}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onMouseLeave={() => setIsPressed(false)}
        onClick={handleClick}
      >
        <div className="camera-button-outer">
          <div className="camera-button-inner">
            <span className="camera-icon">📸</span>
          </div>
        </div>
        {showRipple && <div className="camera-ripple" />}
      </button>
      <div className="camera-hint">Tap to add photo</div>
    </div>
  );
};

// Venmo-style simple action buttons
export const QuickActionButton: React.FC<{
  icon: string;
  label: string;
  onClick: () => void;
  color?: string;
  isActive?: boolean;
  badge?: number;
}> = ({ icon, label, onClick, color = '#4f46e5', isActive = false, badge }) => {
  return (
    <button
      className={`quick-action-button ${isActive ? 'active' : ''}`}
      onClick={onClick}
      style={{ '--button-color': color } as React.CSSProperties}
    >
      <div className="quick-action-icon">
        {icon}
        {badge && badge > 0 && (
          <span className="action-badge">{badge > 99 ? '99+' : badge}</span>
        )}
      </div>
      <span className="quick-action-label">{label}</span>
    </button>
  );
};

// Duolingo-style celebration component
export const CelebrationOverlay: React.FC<{
  show: boolean;
  type: 'success' | 'milestone' | 'streak';
  message: string;
  subMessage?: string;
  onClose: () => void;
}> = ({ show, type, message, subMessage, onClose }) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  if (!show) return null;

  const celebrations = {
    success: { icon: '🎉', color: '#10b981' },
    milestone: { icon: '🏆', color: '#f59e0b' },
    streak: { icon: '🔥', color: '#ef4444' }
  };

  const { icon, color } = celebrations[type];

  return (
    <div className="celebration-overlay">
      <div className="celebration-content" style={{ '--celebration-color': color } as React.CSSProperties}>
        <div className="celebration-icon-wrapper">
          <span className="celebration-icon">{icon}</span>
          <div className="celebration-particles">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="particle" style={{ '--angle': `${i * 30}deg` } as React.CSSProperties} />
            ))}
          </div>
        </div>
        <h2 className="celebration-message">{message}</h2>
        {subMessage && <p className="celebration-submessage">{subMessage}</p>}
        <div className="celebration-progress">
          <div className="progress-fill" />
        </div>
      </div>
    </div>
  );
};

// Achievement badges system
export const AchievementBadge: React.FC<{
  icon: string;
  title: string;
  description: string;
  progress: number;
  maxProgress: number;
  unlocked: boolean;
}> = ({ icon, title, description, progress, maxProgress, unlocked }) => {
  const percentage = (progress / maxProgress) * 100;

  return (
    <div className={`achievement-badge ${unlocked ? 'unlocked' : 'locked'}`}>
      <div className="badge-icon-wrapper">
        <div className="badge-icon">{icon}</div>
        <svg className="badge-progress-ring" width="60" height="60">
          <circle
            cx="30"
            cy="30"
            r="26"
            stroke="#e5e7eb"
            strokeWidth="3"
            fill="none"
          />
          <circle
            cx="30"
            cy="30"
            r="26"
            stroke="url(#badge-gradient)"
            strokeWidth="3"
            fill="none"
            strokeDasharray={`${2 * Math.PI * 26}`}
            strokeDashoffset={`${2 * Math.PI * 26 * (1 - percentage / 100)}`}
            strokeLinecap="round"
            transform="rotate(-90 30 30)"
          />
          <defs>
            <linearGradient id="badge-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4f46e5" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div className="badge-content">
        <h4 className="badge-title">{title}</h4>
        <p className="badge-description">{description}</p>
        <div className="badge-progress-text">
          {progress}/{maxProgress}
        </div>
      </div>
    </div>
  );
};

// Instagram-style photo grid with hover preview
export const InstagramPhotoGrid: React.FC<{
  photos: Photo[];
  onPhotoClick: (photo: Photo) => void;
}> = ({ photos, onPhotoClick }) => {
  const [hoveredPhoto, setHoveredPhoto] = useState<string | null>(null);

  return (
    <div className="instagram-grid">
      {photos.map((photo, index) => (
        <div
          key={photo.id}
          className="instagram-grid-item"
          onClick={() => onPhotoClick(photo)}
          onMouseEnter={() => setHoveredPhoto(photo.id)}
          onMouseLeave={() => setHoveredPhoto(null)}
          style={{ animationDelay: `${index * 0.03}s` }}
        >
          <img src={photo.url} alt="" />
          <div className={`grid-item-overlay ${hoveredPhoto === photo.id ? 'visible' : ''}`}>
            <div className="overlay-stats">
              <span>👁 {Math.floor(Math.random() * 100)}</span>
              <span>❤️ {Math.floor(Math.random() * 50)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Streaks and stats display
export const StreakCounter: React.FC<{
  currentStreak: number;
  bestStreak: number;
  totalPhotos: number;
}> = ({ currentStreak, bestStreak, totalPhotos }) => {
  return (
    <div className="streak-container">
      <div className="streak-item current">
        <span className="streak-icon">🔥</span>
        <div className="streak-content">
          <span className="streak-number">{currentStreak}</span>
          <span className="streak-label">Day Streak</span>
        </div>
      </div>
      <div className="streak-item best">
        <span className="streak-icon">⭐</span>
        <div className="streak-content">
          <span className="streak-number">{bestStreak}</span>
          <span className="streak-label">Best</span>
        </div>
      </div>
      <div className="streak-item total">
        <span className="streak-icon">📸</span>
        <div className="streak-content">
          <span className="streak-number">{totalPhotos}</span>
          <span className="streak-label">Total</span>
        </div>
      </div>
    </div>
  );
};

// Floating action menu (Instagram-style)
export const FloatingActionMenu: React.FC<{
  isOpen: boolean;
  onToggle: () => void;
  actions: Array<{
    icon: string;
    label: string;
    color: string;
    onClick: () => void;
  }>;
}> = ({ isOpen, onToggle, actions }) => {
  return (
    <div className={`floating-action-menu ${isOpen ? 'open' : ''}`}>
      {actions.map((action, index) => (
        <button
          key={index}
          className="floating-action-item"
          onClick={action.onClick}
          style={{
            '--item-delay': `${index * 0.05}s`,
            '--item-color': action.color
          } as React.CSSProperties}
        >
          <span className="action-icon">{action.icon}</span>
          <span className="action-label">{action.label}</span>
        </button>
      ))}
      <button className="floating-action-toggle" onClick={onToggle}>
        <span className={`toggle-icon ${isOpen ? 'close' : 'open'}`}>
          {isOpen ? '✕' : '+'}
        </span>
      </button>
    </div>
  );
};