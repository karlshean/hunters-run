import React, { useEffect, useState } from 'react';
import './photos-premium.css';

interface Particle {
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
}

export const useParticleEffect = () => {
  const [particles, setParticles] = useState<Particle[]>([]);

  const createParticles = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const newParticles: Particle[] = [];
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const velocity = 50 + Math.random() * 50;
      newParticles.push({
        id: Date.now() + i,
        x,
        y,
        tx: Math.cos(angle) * velocity,
        ty: Math.sin(angle) * velocity
      });
    }
    
    setParticles(prev => [...prev, ...newParticles]);
    
    // Clean up after animation
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)));
    }, 1000);
  };

  return { particles, createParticles };
};

export const ParticleContainer: React.FC<{ particles: Particle[] }> = ({ particles }) => {
  return (
    <>
      {particles.map(particle => (
        <div
          key={particle.id}
          className="particle"
          style={{
            left: particle.x,
            top: particle.y,
            '--tx': `${particle.tx}px`,
            '--ty': `${particle.ty}px`
          } as React.CSSProperties}
        />
      ))}
    </>
  );
};

// Ambient floating particles for background
export const AmbientParticles: React.FC = () => {
  const [particles, setParticles] = useState<Array<{ id: number; delay: number; duration: number; size: number }>>([]);

  useEffect(() => {
    const particleCount = 15;
    const newParticles = [];
    
    for (let i = 0; i < particleCount; i++) {
      newParticles.push({
        id: i,
        delay: Math.random() * 10,
        duration: 15 + Math.random() * 10,
        size: 2 + Math.random() * 4
      });
    }
    
    setParticles(newParticles);
  }, []);

  return (
    <div className="ambient-particles">
      {particles.map(particle => (
        <div
          key={particle.id}
          className="ambient-particle"
          style={{
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            left: `${Math.random() * 100}%`,
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`
          }}
        />
      ))}
    </div>
  );
};

// Confetti effect for success states
export const ConfettiEffect: React.FC<{ active: boolean }> = ({ active }) => {
  if (!active) return null;

  return (
    <div className="confetti-container">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="confetti"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 0.5}s`,
            backgroundColor: ['#4f46e5', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'][Math.floor(Math.random() * 5)]
          }}
        />
      ))}
    </div>
  );
};