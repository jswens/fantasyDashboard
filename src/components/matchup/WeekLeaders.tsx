import { useState } from 'react';
import TeamLogo from '@/components/common/TeamLogo';
import { formatPoints } from '@/lib/utils/efficiency';
import type { MatchupStatus } from '@/components/matchup/MatchupCard';

export interface LeaderRow {
  team_id: string;
  team_name: string;
  owner_name: string;
  avatar_url: string | null;
  points: number;
}

interface WeekLeadersProps {
  week: number;
  status: MatchupStatus;
  // This week's sides, starters' points only. Unsorted.
  weekRows: LeaderRow[];
  // Season totals including this week (or through last week when upcoming).
  // null while loading or when it couldn't be fetched.
  seasonRows: LeaderRow[] | null;
  seasonThroughWeek: number;
  seasonError: string | null;
}

const COLLAPSED_COUNT = 5;

function rankPoints(rows: LeaderRow[]): LeaderRow[] {
  return [...rows].sort((a, b) => b.points - a.points || a.team_name.localeCompare(b.team_name));
}

function LeaderList({ rows, showAll }: { rows: LeaderRow[]; showAll: boolean }) {
  const ranked = rankPoints(rows);
  const visible = showAll ? ranked : ranked.slice(0, COLLAPSED_COUNT);
  const top = ranked[0]?.points ?? 0;

  return (
    <ol className="mt-3 space-y-1.5">
      {visible.map((row, idx) => {
        // Ties share a rank ("1, 1, 3") rather than implying an order that
        // doesn't exist.
        const rank = ranked.findIndex((r) => r.points === row.points) + 1;
        const barPct = top > 0 ? Math.max(0, (row.points / top) * 100) : 0;
        return (
          <li key={row.team_id} className="relative overflow-hidden rounded-lg px-2 py-1.5">
            <div
              aria-hidden
              className={`absolute inset-y-0 left-0 rounded-lg ${
                idx === 0 ? 'bg-sleeper-teal/15' : 'bg-sleeper-surface-hover'
              }`}
              style={{ width: `${barPct}%` }}
            />
            <div className="relative flex items-center gap-3">
              <span
                className={`w-5 flex-shrink-0 text-right text-xs font-semibold tabular-nums ${
                  rank === 1 ? 'text-sleeper-teal' : 'text-sleeper-faint'
                }`}
              >
                {rank}
              </span>
              <TeamLogo avatarUrl={row.avatar_url} teamName={row.team_name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-sleeper-text">{row.team_name}</p>
                <p className="truncate text-xs text-sleeper-muted">{row.owner_name}</p>
              </div>
              <span className="flex-shrink-0 text-sm font-semibold tabular-nums text-sleeper-text">
                {formatPoints(row.points)}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// Two leaderboards side by side: this week's top scorers (starters only --
// the same number the matchup is decided on) and the season-to-date totals.
export default function WeekLeaders({
  week,
  status,
  weekRows,
  seasonRows,
  seasonThroughWeek,
  seasonError,
}: WeekLeadersProps) {
  const [showAll, setShowAll] = useState(false);
  const showWeek = status !== 'upcoming' && weekRows.length > 0;
  const hasSeason = seasonThroughWeek >= 1;

  if (!showWeek && !hasSeason) return null;

  const listLength = Math.max(showWeek ? weekRows.length : 0, seasonRows?.length ?? 0);
  const canExpand = listLength > COLLAPSED_COUNT;

  return (
    <section className="mb-6 rounded-xl border border-sleeper-border bg-sleeper-surface p-4">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {showWeek && (
          <div>
            <h3 className="text-sm font-semibold text-sleeper-text">Top scorers · Week {week}</h3>
            <p className="text-xs text-sleeper-faint">
              Starting lineup points{status === 'live' ? ' · live' : ''}
            </p>
            <LeaderList rows={weekRows} showAll={showAll} />
          </div>
        )}

        {hasSeason && (
          <div>
            <h3 className="text-sm font-semibold text-sleeper-text">
              Season leaders · through Week {seasonThroughWeek}
            </h3>
            <p className="text-xs text-sleeper-faint">
              Total points scored{status === 'live' && seasonThroughWeek === week ? ' · includes live week' : ''}
            </p>
            {seasonRows ? (
              <LeaderList rows={seasonRows} showAll={showAll} />
            ) : seasonError ? (
              <p className="mt-3 text-sm text-sleeper-red">{seasonError}</p>
            ) : (
              <p className="mt-3 text-sm text-sleeper-muted">Loading season totals…</p>
            )}
          </div>
        )}
      </div>

      {canExpand && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="rounded-full border border-sleeper-border px-3 py-1 text-xs font-semibold text-sleeper-muted transition-colors hover:border-sleeper-teal/50 hover:text-sleeper-text"
          >
            {showAll ? 'Show top 5' : `Show all ${listLength}`}
          </button>
        </div>
      )}
    </section>
  );
}
