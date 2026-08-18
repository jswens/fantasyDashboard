import { useState } from 'react';
import { getPlayerHeadshotUrl } from '@/lib/utils/images';

interface PlayerAvatarProps {
  playerId: string;
  fullName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<PlayerAvatarProps['size']>, string> = {
  sm: 'w-10 h-10 text-xs',
  md: 'w-14 h-14 text-sm',
  lg: 'w-20 h-20 text-base',
};

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function PlayerAvatar({ playerId, fullName, size = 'sm', className = '' }: PlayerAvatarProps) {
  const [errored, setErrored] = useState(false);
  const sizeClass = SIZE_CLASSES[size];

  if (errored) {
    return (
      <div className={`${sizeClass} ${className} rounded-full bg-sleeper-bg border border-sleeper-border flex items-center justify-center flex-shrink-0`}>
        <span className="font-medium text-sleeper-muted">{getInitials(fullName)}</span>
      </div>
    );
  }

  return (
    <img
      src={getPlayerHeadshotUrl(playerId)}
      alt={fullName}
      loading="lazy"
      onError={() => setErrored(true)}
      className={`${sizeClass} ${className} rounded-full bg-sleeper-bg border border-sleeper-border object-cover flex-shrink-0`}
    />
  );
}
