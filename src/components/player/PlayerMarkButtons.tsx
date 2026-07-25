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
    activeClass: 'bg-purple-600 text-white border-purple-600',
  },
  target: {
    label: 'T',
    title: 'Target',
    activeClass: 'bg-green-600 text-white border-green-600',
  },
  avoid: {
    label: 'A',
    title: 'Avoid',
    activeClass: 'bg-red-600 text-white border-red-600',
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
                : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50',
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
