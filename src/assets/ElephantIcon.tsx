import React from 'react';
import elephantIconSrc from '../assets/elephant-icon.png';

interface ElephantIconProps {
  className?: string;
  /** When true, slightly stronger presence (active tab) */
  fill?: boolean;
}

/**
 * Nav / brand elephant mark — uses the provided icons8 silhouette PNG.
 * Inherits text color via CSS mask so active/inactive + dark mode work.
 */
export const ElephantIcon: React.FC<ElephantIconProps> = ({
  className = 'w-6 h-6',
  fill = false,
}) => {
  return (
    <span
      role="img"
      aria-hidden
      className={`inline-block ${className} ${fill ? 'opacity-100' : 'opacity-90'}`}
      style={{
        backgroundColor: 'currentColor',
        maskImage: `url(${elephantIconSrc})`,
        WebkitMaskImage: `url(${elephantIconSrc})`,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
      }}
    />
  );
};
