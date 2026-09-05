import React from 'react';

interface ElephantHeartPopProps {
  show: boolean;
  position?: { x: number; y: number } | null;
}

// User provided clean cut-out heart with dark green elephant
const ALIMEDIA_LIKE_HEART_IMAGE = 'https://i.ibb.co/fVWNy9ZN/1000131158-removebg-preview.png';

/**
 * AliMedia Instagram-style Double-Tap Like Animation
 * Uses: https://i.ibb.co/fVWNy9ZN/1000131158-removebg-preview.png
 */
export const ElephantHeartPop: React.FC<ElephantHeartPopProps> = ({ show, position }) => {
  if (!show) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-40 flex items-center justify-center overflow-hidden"
      style={
        position
          ? {
              left: `${position.x}px`,
              top: `${position.y}px`,
              transform: 'translate(-50%, -50%)',
              position: 'absolute',
              width: '180px',
              height: '180px',
            }
          : undefined
      }
    >
      {/* Instagram-style scale/pop effect with exact provided image */}
      <div className="relative animate-instagramHeartPop flex items-center justify-center pointer-events-none select-none">
        <img
          src={ALIMEDIA_LIKE_HEART_IMAGE}
          alt="Like"
          className="w-32 h-32 sm:w-40 sm:h-40 object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.3)] filter transition-all"
          loading="eager"
          decoding="async"
        />
      </div>
    </div>
  );
};
