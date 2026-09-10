import Link from 'next/link';
import { MatchupSide } from '@/lib/types/matchup';
import { formatPoints } from '@/lib/utils/efficiency';

interface BenchListProps {
  side: MatchupSide;
}

// Bench players, dimmed relative to the starters block above and sorted by
// points descending -- on the bench, slot order has no meaning (there's no
// slot at all), so "who scored the most" is the useful ordering.
export default function BenchList({ side }: BenchListProps) {
  const bench = [...side.players].filter((p) => !p.is_starter).sort((a, b) => b.points - a.points);

  return (
    <div className="rounded-xl border border-sleeper-border bg-sleeper-surface p-4 opacity-70">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-sleeper-muted">{side.team_name} bench</h4>
        <span className="text-xs text-sleeper-faint">Total {formatPoints(side.bench_points)}</span>
      </div>
      {bench.length === 0 ? (
        <p className="text-xs text-sleeper-faint">No bench players.</p>
      ) : (
        <div className="space-y-1">
          {bench.map((player) => (
            <div key={player.player_id} className="flex items-center justify-between gap-2 text-xs">
              <Link
                href={`/players/${player.player_id}`}
                className="truncate text-sleeper-muted hover:text-sleeper-text"
              >
                {player.full_name} <span className="text-sleeper-faint">{player.position}</span>
              </Link>
              <span className="flex-shrink-0 text-sleeper-muted">{formatPoints(player.points)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
