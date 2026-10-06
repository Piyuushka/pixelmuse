import React from 'react';

export interface LogoProps {
  size?: number | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  alt?: string;
  withShadow?: boolean;
}

const PRESET_SIZES = {
  sm: 32,
  md: 40,
  lg: 48,
  xl: 56,
  '2xl': 64,
};

export default function Logo({
  size = 'md',
  className = '',
  alt = 'PathFinder Logo',
  withShadow = true,
}: LogoProps) {
  const pixelSize = typeof size === 'number' ? size : PRESET_SIZES[size] || 40;

  return (
    <img
      src="/logo.png"
      alt={alt}
      width={pixelSize}
      height={pixelSize}
      className={`inline-block object-contain select-none shrink-0 rounded-2xl ${
        withShadow ? 'shadow-md' : ''
      } transition-transform ${className}`}
      style={{
        width: `${pixelSize}px`,
        height: `${pixelSize}px`,
      }}
      loading="eager"
    />
  );
}
