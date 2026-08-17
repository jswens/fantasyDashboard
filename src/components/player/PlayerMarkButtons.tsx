import { PlayerMarkType } from '@/lib/types/marks';

interface PlayerMarkButtonsProps {
  playerId: string;
  currentMark: PlayerMarkType | null;
  onChange: (mark: PlayerMarkType | null) => void;
  disabled?: boolean;
}

const MARK_CONFIG: Record<PlayerMarkType, { label: string; title: string; activeClass: string }> = {
  sleeper: {
    label: 'S',
    title: 'Sleeper',
    activeClass: 'bg-sleeper-purple text-sleeper-bg border-sleeper-purple',
  },
  target: {
    label: 'T',
    title: 'Target',
    activeClass: 'bg-sleeper-teal text-sleeper-bg border-sleeper-teal',
  },
  avoid: {
    label: 'A',
    title: 'Avoid',
    activeClass: 'bg-sleeper-red text-sleeper-bg border-sleeper-red',
  },
};

const MARK_ORDER: PlayerMarkType[] = ['sleeper', 'target', 'avoid'];

// Compact S/T/A toggle group. Clicking the active mark again clears it.
export default function PlayerMarkButtons({
  playerId,
  currentMark,
  onChange,
  disabled = false,
}: PlayerMarkButtonsProps) {
  const handleClick = (mark: PlayerMarkType) => {
    if (disabled) return;
    onChange(currentMark === mark ? null : mark);
  };

  return (
    <div className="inline-flex items-center rounded-md shadow-sm" data-player-id={playerId} role="group" aria-label="Player mark">
      {MARK_ORDER.map((mark, index) => {
        const config = MARK_CONFIG[mark];
        const isActive = currentMark === mark;

        return (
          <button
            key={mark}
            type="button"
            title={config.title}
            aria-pressed={isActive}
            disabled={disabled}
            onClick={() => handleClick(mark)}
            className={[
              'w-7 h-7 text-xs font-semibold border transition-colors',
              index === 0 ? 'rounded-l-md' : '',
              index === MARK_ORDER.length - 1 ? 'rounded-r-md' : '',
              index > 0 ? '-ml-px' : '',
              isActive
                ? config.activeClass
                : 'bg-sleeper-surface text-sleeper-muted border-sleeper-border hover:bg-sleeper-surface-hover',
              disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
            ].join(' ')}
          >
            {config.label}
          </button>
        );
      })}
    </div>
  );
}
