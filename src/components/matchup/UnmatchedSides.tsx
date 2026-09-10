import TeamLogo from '@/components/common/TeamLogo';
import { MatchupSide } from '@/lib/types/matchup';
import { formatPoints } from '@/lib/utils/efficiency';

interface UnmatchedSidesProps {
  sides: MatchupSide[];
}

// Sleeper sides with no matchup_id -- shouldn't happen in a 12-team league,
// but the API surfaces them rather than dropping them (see WeekScoreboard.
// unmatched), so the UI does the same instead of silently losing a roster.
export default function UnmatchedSides({ sides }: UnmatchedSidesProps) {
  if (sides.length === 0) return null;

  return (
    <div className="mt-8">
      <h3 className="text-sm font-semibold text-sleeper-text">Unpaired this week</h3>
      <p className="mt-1 text-xs text-sleeper-faint">
        Sleeper returned these rosters without an opponent. Surfaced here instead of hidden --
        it usually means a league data problem worth checking.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sides.map((side) => (
          <div
            key={side.team_id}
            className="flex items-center gap-3 rounded-lg border border-sleeper-border bg-sleeper-surface p-3"
          >
            <TeamLogo avatarUrl={side.avatar_url} teamName={side.team_name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sleeper-text">{side.team_name}</p>
              <p className="truncate text-xs text-sleeper-muted">{side.owner_name}</p>
            </div>
            <p className="flex-shrink-0 text-sm font-semibold text-sleeper-text">
              {formatPoints(side.points)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
