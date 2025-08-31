import React, { useState, useEffect } from 'react';
import { 
  PhotoStoryBubbles, 
  SnapCameraButton, 
  QuickActionButton,
  CelebrationOverlay,
  AchievementBadge,
  InstagramPhotoGrid,
  StreakCounter,
  FloatingActionMenu
} from '../features/photos/InstagramStyle';
import { PhotoUploader } from '../features/photos/PhotoUploader';
import { mockPhotoService, Photo } from '../features/photos/mockPhotoService';
import '../features/photos/social-media-style.css';

const SocialMediaDemo: React.FC = () => {
  const [currentView, setCurrentView] = useState<'feed' | 'camera' | 'profile'>('feed');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationType, setCelebrationType] = useState<'success' | 'milestone' | 'streak'>('success');
  const [celebrationMessage, setCelebrationMessage] = useState('');
  const [showUploader, setShowUploader] = useState(false);
  const [floatingMenuOpen, setFloatingMenuOpen] = useState(false);
  const [userStats, setUserStats] = useState({
    streak: 3,
    bestStreak: 7,
    totalPhotos: 24,
    badges: 0
  });

  // Load initial photos
  useEffect(() => {
    loadPhotos();
  }, []);

  const loadPhotos = async () => {
    const groups = await mockPhotoService.list('wo-demo-1');
    const allPhotos = [
      ...groups.before,
      ...groups.during,
      ...groups.after,
      ...groups.tenant,
      ...groups.manager
    ];
    setPhotos(allPhotos);
  };

  const handlePhotoCapture = () => {
    setShowUploader(true);
    // Haptic-like visual feedback
    document.body.style.transform = 'scale(0.99)';
    setTimeout(() => {
      document.body.style.transform = 'scale(1)';
    }, 100);
  };

  const handlePhotoComplete = (photo: Photo) => {
    setPhotos(prev => [...prev, photo]);
    setShowUploader(false);
    
    // Update stats
    const newTotal = userStats.totalPhotos + 1;
    setUserStats(prev => ({
      ...prev,
      totalPhotos: newTotal
    }));

    // Trigger celebrations at milestones
    if (newTotal === 25) {
      triggerCelebration('milestone', '25 Photos! 🎯', 'You\'re on fire!');
    } else if (newTotal % 5 === 0) {
      triggerCelebration('success', 'Nice Shot! 📸', `${newTotal} photos captured`);
    } else {
      triggerCelebration('success', 'Photo Added! ✨', 'Keep going!');
    }
  };

  const triggerCelebration = (type: 'success' | 'milestone' | 'streak', message: string, subMessage?: string) => {
    setCelebrationType(type);
    setCelebrationMessage(message);
    setShowCelebration(true);
    
    // Increment streak
    if (type === 'success') {
      setUserStats(prev => ({
        ...prev,
        streak: prev.streak + 0.1
      }));
    }
  };

  const storyCategories = [
    { type: 'Your Story', count: 0, hasNew: true, icon: '➕', gradient: 'linear-gradient(135deg, #667eea, #764ba2)' },
    { type: 'Before', count: photos.filter(p => p.kind === 'TECH_BEFORE').length, hasNew: false, icon: '🏗️', gradient: 'linear-gradient(135deg, #f093fb, #f5576c)' },
    { type: 'During', count: photos.filter(p => p.kind === 'TECH_DURING').length, hasNew: false, icon: '🔨', gradient: 'linear-gradient(135deg, #4facfe, #00f2fe)' },
    { type: 'After', count: photos.filter(p => p.kind === 'TECH_AFTER').length, hasNew: true, icon: '✅', gradient: 'linear-gradient(135deg, #43e97b, #38f9d7)' },
    { type: 'Tenant', count: photos.filter(p => p.kind === 'TENANT_SUBMITTED').length, hasNew: false, icon: '🏠', gradient: 'linear-gradient(135deg, #fa709a, #fee140)' },
    { type: 'Manager', count: photos.filter(p => p.kind === 'MANAGER_NOTE').length, hasNew: false, icon: '👔', gradient: 'linear-gradient(135deg, #30cfd0, #330867)' }
  ];

  const achievements = [
    { icon: '🎯', title: 'First Photo', description: 'Upload your first photo', progress: 1, maxProgress: 1, unlocked: true },
    { icon: '🔥', title: 'Hot Streak', description: '3 day photo streak', progress: userStats.streak, maxProgress: 3, unlocked: userStats.streak >= 3 },
    { icon: '📸', title: 'Shutterbug', description: 'Upload 25 photos', progress: userStats.totalPhotos, maxProgress: 25, unlocked: userStats.totalPhotos >= 25 },
    { icon: '⚡', title: 'Speed Demon', description: 'Complete in 24 hours', progress: 0, maxProgress: 1, unlocked: false }
  ];

  const floatingActions = [
    { icon: '📸', label: 'Camera', color: '#10b981', onClick: () => handlePhotoCapture() },
    { icon: '📁', label: 'Gallery', color: '#f59e0b', onClick: () => setCurrentView('feed') },
    { icon: '🏆', label: 'Achievements', color: '#ef4444', onClick: () => setCurrentView('profile') }
  ];

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #fafafa 0%, #f0f0f0 100%)',
      paddingBottom: '80px'
    }}>
      {/* Header - Instagram style */}
      <div style={{
        background: 'white',
        padding: '16px 20px',
        borderBottom: '1px solid rgba(219, 219, 219, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(10px)'
      }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: '800',
          margin: 0,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          PhotoFlow
        </h1>
        <StreakCounter 
          currentStreak={Math.floor(userStats.streak)}
          bestStreak={userStats.bestStreak}
          totalPhotos={userStats.totalPhotos}
        />
      </div>

      {/* Story Bubbles */}
      <PhotoStoryBubbles 
        categories={storyCategories}
        onCategoryClick={(type) => {
          if (type === 'Your Story') {
            handlePhotoCapture();
          }
        }}
      />

      {/* Main Content Area */}
      {currentView === 'feed' && (
        <div style={{ padding: '20px' }}>
          {/* Snapchat-style camera button */}
          <SnapCameraButton 
            onCapture={handlePhotoCapture}
            isCapturing={showUploader}
          />

          {/* Venmo-style quick actions */}
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'center',
            marginBottom: '32px',
            flexWrap: 'wrap'
          }}>
            <QuickActionButton 
              icon="🏗️"
              label="Before"
              onClick={() => {}}
              color="#f093fb"
              badge={photos.filter(p => p.kind === 'TECH_BEFORE').length}
            />
            <QuickActionButton 
              icon="🔨"
              label="During"
              onClick={() => {}}
              color="#4facfe"
              badge={photos.filter(p => p.kind === 'TECH_DURING').length}
            />
            <QuickActionButton 
              icon="✅"
              label="After"
              onClick={() => {}}
              color="#43e97b"
              badge={photos.filter(p => p.kind === 'TECH_AFTER').length}
              isActive={true}
            />
          </div>

          {/* Instagram-style photo grid */}
          {photos.length > 0 ? (
            <InstagramPhotoGrid 
              photos={photos}
              onPhotoClick={(photo) => {
                triggerCelebration('success', 'Nice photo! 👀', 'Tap to view details');
              }}
            />
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#8e8e8e'
            }}>
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>📸</div>
              <h3 style={{ margin: '0 0 8px 0', color: '#262626' }}>No photos yet</h3>
              <p style={{ margin: 0 }}>Tap the camera to get started!</p>
            </div>
          )}
        </div>
      )}

      {currentView === 'profile' && (
        <div style={{ padding: '20px' }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '700',
            margin: '0 0 24px 0',
            color: '#262626'
          }}>
            Your Achievements
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {achievements.map((achievement, index) => (
              <AchievementBadge key={index} {...achievement} />
            ))}
          </div>
        </div>
      )}

      {/* Photo Uploader Modal */}
      {showUploader && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'white',
          zIndex: 2000,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <button
              onClick={() => setShowUploader(false)}
              style={{
                border: 'none',
                background: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              ✕
            </button>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Add Photo</h3>
            <div style={{ width: '32px' }}></div>
          </div>
          <div style={{ flex: 1, padding: '20px', overflow: 'auto' }}>
            <PhotoUploader
              workOrderId="wo-demo-1"
              kind="TENANT_SUBMITTED"
              role="TENANT"
              maxFiles={1}
              onUploadComplete={handlePhotoComplete}
              helpText="Show us what needs attention"
            />
          </div>
        </div>
      )}

      {/* Celebration Overlay */}
      <CelebrationOverlay 
        show={showCelebration}
        type={celebrationType}
        message={celebrationMessage}
        subMessage={celebrationType === 'milestone' ? `${userStats.badges} badges earned!` : undefined}
        onClose={() => setShowCelebration(false)}
      />

      {/* Floating Action Menu */}
      <FloatingActionMenu 
        isOpen={floatingMenuOpen}
        onToggle={() => setFloatingMenuOpen(!floatingMenuOpen)}
        actions={floatingActions}
      />

      {/* Bottom Navigation - Instagram style */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'white',
        borderTop: '1px solid rgba(219, 219, 219, 0.3)',
        padding: '8px 0',
        display: 'flex',
        justifyContent: 'space-around',
        zIndex: 100
      }}>
        {[
          { icon: '🏠', view: 'feed' as const },
          { icon: '📸', view: 'camera' as const },
          { icon: '👤', view: 'profile' as const }
        ].map(nav => (
          <button
            key={nav.view}
            onClick={() => nav.view === 'camera' ? handlePhotoCapture() : setCurrentView(nav.view)}
            style={{
              border: 'none',
              background: 'none',
              fontSize: '24px',
              padding: '8px 20px',
              cursor: 'pointer',
              opacity: currentView === nav.view ? 1 : 0.5,
              transform: currentView === nav.view ? 'scale(1.1)' : 'scale(1)',
              transition: 'all 0.2s ease'
            }}
          >
            {nav.icon}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SocialMediaDemo;