import React from 'react';
import { ALI_MEDIA_LOGO_URL } from '../utils/aliMediaTeam';

/**
 * Official Ali Media elephant icon avatar.
 * Dark green on light backgrounds; auto-flips to white in dark theme via CSS.
 */
export const TeamAvatar: React.FC<{
  size?: number | string;
  className?: string;
  ring?: boolean;
}> = ({ size = 40, className = '', ring = false }) => {
  const dim = typeof size === 'number' ? `${size}px` : size;
  return (
    <div
      className={`rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-parchment-50 dark:bg-zinc-900 ${
        ring ? 'ring-2 ring-[#062E22]/80 dark:ring-emerald-400/50' : ''
      } ${className}`}
      style={{ width: dim, height: dim }}
      title="Ali Media"
    >
      <img
        src={ALI_MEDIA_LOGO_URL}
        alt="Ali Media"
        className="ali-team-icon w-[78%] h-[78%] object-contain"
      />
    </div>
  );
};

export default TeamAvatar;
