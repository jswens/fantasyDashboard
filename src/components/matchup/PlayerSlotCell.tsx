import Link from 'next/link';
import PlayerAvatar from '@/components/common/PlayerAvatar';
import { ZeroCapWarning } from '@/components/common/ZeroCapWarning';
import { MatchupPlayer } from '@/lib/types/matchup';
import { formatCapCompact, formatPoints, formatPpm } from '@/lib/utils/efficiency';
import { PPM_TOOLTIP } from './constants';

interface PlayerSlotCellProps {
  player: MatchupPlayer | null;
  highlight: 'best' | 'worst' | null;
}

// One player's half of a slot row. Two null-PPM cases look identical on the
// surface (formatPpm returns the same em dash) but mean different things:
//
// - cap_unknown: the player scored but wasn't on the cached roster (a
//   mid-week waiver pickup), so cap_value is 0 and *unreliable* -- it's not
//   that the player's cap hit is really zero, we just don't know it yet.
// - a real $0 cap hit (cap_unknown false, ppm still null): the existing
//   ZeroCapWarning badge used across the app.
//
// cap_unknown is checked first and wins -- it's the more specific, more
// actionable fact, and showing both badges for the same null PPM would be
// confusing noise.
export default function PlayerSlotCell({ player, highlight }: PlayerSlotCellProps) {
  if (!player) {
    return (
      <div className="flex min-w-0 flex-1 items-center justify-center rounded-lg border border-dashed border-sleeper-border px-2 py-3 text-xs text-sleeper-faint">
        Empty
      </div>
    );
  }

  const showZeroCapBadge = player.ppm === null && !player.cap_unknown;
  const showCapUnknownNote = player.cap_unknown === true;

  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 ${
        highlight === 'best'
          ? 'bg-sleeper-teal-muted ring-1 ring-sleeper-teal/40'
          : highlight === 'worst'
            ? 'bg-sleeper-red-muted ring-1 ring-sleeper-red/40'
            : ''
      }`}
    >
      <PlayerAvatar playerId={player.player_id} fullName={player.full_name} size="sm" />
      <div className="min-w-0 flex-1">
        <Link
          href={`/players/${player.player_id}`}
          className="block truncate text-sm font-medium text-sleeper-text hover:text-sleeper-teal"
        >
          {player.full_name}
        </Link>
        <p className="truncate text-xs text-sleeper-muted">
          {player.position}
          {player.nfl_team ? ` • ${player.nfl_team}` : ''}
        </p>
        {showZeroCapBadge && <ZeroCapWarning className="text-xs" />}
        {showCapUnknownNote && (
          <span className="mt-0.5 inline-block rounded border border-sleeper-border bg-sleeper-surface-hover px-1.5 py-0.5 text-[11px] font-medium text-sleeper-muted">
            Cap unknown
          </span>
        )}
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="text-sm font-semibold text-sleeper-text">{formatPoints(player.points)}</p>
        <p className="text-xs text-sleeper-muted">{formatCapCompact(player.cap_value)}</p>
        <p className="text-xs text-sleeper-faint" title={PPM_TOOLTIP}>
          {formatPpm(player.ppm)}
        </p>
      </div>
    </div>
  );
}
