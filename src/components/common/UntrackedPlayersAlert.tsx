import Link from 'next/link';
import type { Team } from '@/lib/types';

interface UntrackedPlayersAlertProps {
  teams: Team[];
  canEdit: boolean;
  /** Hide the fantasy team name on each row (e.g. on a single team's page). */
  hideTeamNames?: boolean;
}

// Rostered players the dashboard has no record of are left out of rosters and
// cap totals. Call them out so the totals are never silently understated.
export default function UntrackedPlayersAlert({ teams, canEdit, hideTeamNames = false }: UntrackedPlayersAlertProps) {
  const rows = teams.flatMap(team =>
    (team.untracked_players ?? []).map(p => ({ ...p, teamId: team.team_id, teamName: team.team_name }))
  );
  if (rows.length === 0) return null;

  const count = rows.length;

  return (
    <div className="mb-6 rounded-xl border border-sleeper-yellow/40 bg-sleeper-yellow/10 p-4">
      <div className="flex items-start gap-3">
        <svg className="w-5 h-5 mt-0.5 flex-shrink-0 text-sleeper-yellow" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-sleeper-yellow">
            {count} rostered player{count === 1 ? ' isn’t' : 's aren’t'} tracked
          </h3>
          <p className="mt-1 text-sm text-sleeper-muted">
            {count === 1 ? 'This player is' : 'These players are'} on a Sleeper roster but missing from the
            dashboard&apos;s player data, so they’re not shown on the roster or counted in cap totals.
            {!canEdit && ' A commissioner needs to add them.'}
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {rows.map(p => (
              <li key={`${p.teamId}-${p.player_id}`} className="text-sleeper-text">
                <span className="font-medium">{p.full_name ?? `Sleeper player ${p.player_id}`}</span>
                {(p.position || p.nfl_team) && (
                  <span className="text-sleeper-muted"> · {[p.position, p.nfl_team ?? 'FA'].filter(Boolean).join(' · ')}</span>
                )}
                {!hideTeamNames && (
                  <>
                    <span className="text-sleeper-faint"> on </span>
                    <Link href={`/teams/${p.teamId}`} className="text-sleeper-muted hover:text-sleeper-teal">
                      {p.teamName}
                    </Link>
                  </>
                )}
              </li>
            ))}
          </ul>
          {canEdit && (
            <Link
              href="/players"
              className="mt-3 inline-flex items-center text-sm font-semibold text-sleeper-teal hover:text-sleeper-teal-dark"
            >
              Add {count === 1 ? 'this player' : 'them'} on the Players page &rarr;
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
