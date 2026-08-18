import { useState } from 'react';

interface TeamLogoProps {
  avatarUrl: string | null;
  teamName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<TeamLogoProps['size']>, string> = {
  sm: 'w-10 h-10 text-xs',
  md: 'w-14 h-14 text-sm',
  lg: 'w-20 h-20 text-lg',
};

function getInitials(teamName: string): string {
  const words = teamName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export default function TeamLogo({ avatarUrl, teamName, size = 'sm', className = '' }: TeamLogoProps) {
  const [errored, setErrored] = useState(false);
  const sizeClass = SIZE_CLASSES[size];

  if (!avatarUrl || errored) {
    return (
      <div className={`${sizeClass} ${className} rounded-full bg-sleeper-teal-muted border border-sleeper-teal/30 flex items-center justify-center flex-shrink-0`}>
        <span className="font-semibold text-sleeper-teal">{getInitials(teamName)}</span>
      </div>
    );
  }

  return (
    <img
      src={avatarUrl}
      alt={`${teamName} logo`}
      loading="lazy"
      onError={() => setErrored(true)}
      className={`${sizeClass} ${className} rounded-full bg-sleeper-bg border border-sleeper-border object-cover flex-shrink-0`}
    />
  );
}
