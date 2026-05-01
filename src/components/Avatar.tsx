import React from 'react';
import { Avatar as RadixAvatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface AvatarProps {
  src?: string;
  fallback?: string;
  frameUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_MAP: Record<string, number> = {
  sm: 32,
  md: 40,
  lg: 64,
  xl: 96,
};

export function Avatar({ src, fallback, frameUrl, size = 'md', className }: AvatarProps) {
  const px = SIZE_MAP[size];
  return (
    <div
      className={`relative inline-block ${className || ''}`}
      style={{ width: px, height: px }}
    >
      <RadixAvatar className="w-full h-full">
        <AvatarImage src={src} className="object-cover" />
        <AvatarFallback className="text-xs font-bold">
          {fallback?.slice(0, 2).toUpperCase() || '?'}
        </AvatarFallback>
      </RadixAvatar>
      {frameUrl && (
        <img
          src={frameUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10"
        />
      )}
    </div>
  );
}

export default Avatar;
