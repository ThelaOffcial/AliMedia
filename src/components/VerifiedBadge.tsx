import React from 'react';

/**
 * Official Ali Media verified badge — uses the solid teal seal image
 * (thick, clear check — matches the uploaded verify mark).
 * Includes a continuous shine + soft glow animation.
 */
export const VerifiedBadge: React.FC<{
  size?: number;
  className?: string;
  title?: string;
}> = ({
  size = 18,
  className = '',
  title = 'Verified · Official Ali Media',
}) => (
  <span
    className={`verified-badge-shine inline-flex items-center justify-center shrink-0 ${className}`}
    title={title}
    aria-label={title}
    style={{ width: size, height: size, minWidth: size, minHeight: size }}
  >
    <img
      src="/icons/verify-badge.png"
      alt=""
      width={size}
      height={size}
      draggable={false}
      className="block object-contain select-none"
      style={{ width: size, height: size }}
    />
  </span>
);

export default VerifiedBadge;
