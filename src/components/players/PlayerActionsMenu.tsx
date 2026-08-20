import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

interface PlayerActionsMenuProps {
  playerId: string;
}

/** "⋮" menu shown on player rows for commissioners/admins — currently just links to the edit page. */
export default function PlayerActionsMenu({ playerId }: PlayerActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Player actions"
        aria-haspopup="true"
        aria-expanded={open}
        className="p-1.5 rounded-full text-sleeper-muted hover:text-sleeper-text hover:bg-sleeper-surface-hover transition-colors"
      >
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 6a2 2 0 100-4 2 2 0 000 4zM10 12a2 2 0 100-4 2 2 0 000 4zM10 18a2 2 0 100-4 2 2 0 000 4z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-1 w-40 origin-top-right rounded-md bg-sleeper-surface border border-sleeper-border shadow-lg focus:outline-none">
          <div className="py-1">
            <Link
              href={`/players/${playerId}`}
              className="block px-4 py-2 text-sm text-sleeper-text hover:bg-sleeper-surface-hover"
              onClick={() => setOpen(false)}
            >
              Edit player
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
