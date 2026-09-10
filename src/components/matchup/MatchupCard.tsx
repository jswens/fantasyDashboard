import { WeekMatchup } from '@/lib/types/matchup';
import { formatPoints } from '@/lib/utils/efficiency';
import MatchupSideCard from './MatchupSideCard';
import MatchupLineupPanel from './MatchupLineupPanel';

export type MatchupStatus = 'upcoming' | 'live' | 'final';

interface MatchupCardProps {
  matchup: WeekMatchup;
  week: number;
  status: MatchupStatus;
  startingSlots: string[];
  isExpanded: boolean;
  onToggle: (matchupId: number) => void;
}

// The card expands in place rather than navigating: on gameday the point of
// this screen is watching all six games at once, and a round trip to a detail
// page loses that (and your scroll position, and any other open card). The
// full drill-in page is still reachable from inside the expanded panel.
//
// The header is a <button>, not a wrapping <Link> as before -- the panel it
// opens contains links of its own, which can't be nested inside an anchor.
export default function MatchupCard({
  matchup,
  week,
  status,
  startingSlots,
  isExpanded,
  onToggle,
}: MatchupCardProps) {
  const [sideA, sideB] = matchup.sides;
  const isUpcoming = status === 'upcoming';
  const panelId = `matchup-panel-${matchup.matchup_id}`;

  return (
    <div
      className={`rounded-xl border bg-sleeper-surface transition-colors ${
        isExpanded ? 'border-sleeper-teal/40' : 'border-sleeper-border hover:border-sleeper-teal/50'
      }`}
    >
      <button
        type="button"
        onClick={() => onToggle(matchup.matchup_id)}
        aria-expanded={isExpanded}
        // Only while the panel exists -- the panel is unmounted when collapsed,
        // and aria-controls pointing at a missing id is worse than omitting it.
        aria-controls={isExpanded ? panelId : undefined}
        className="w-full rounded-xl p-4 text-left transition-colors hover:bg-sleeper-surface-hover"
      >
        <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <MatchupSideCard side={sideA} isLeader={matchup.leader_team_id === sideA.team_id} isUpcoming={isUpcoming} />

          <div className="flex flex-col items-center justify-center px-2 text-center">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-sleeper-faint">
              {status === 'upcoming' ? 'Scheduled' : status === 'live' ? 'Live' : 'Final'}
            </span>
            {isUpcoming ? (
              <span className="mt-1 text-sm font-bold text-sleeper-faint">vs</span>
            ) : (
              <span className="mt-1 text-xs font-medium text-sleeper-muted">
                {matchup.leader_team_id ? `by ${formatPoints(matchup.margin)}` : 'Tied'}
              </span>
            )}
          </div>

          <MatchupSideCard side={sideB} isLeader={matchup.leader_team_id === sideB.team_id} isUpcoming={isUpcoming} />
        </div>

        <div className="mt-2 flex items-center justify-center gap-1 text-xs font-medium text-sleeper-faint">
          {isExpanded ? 'Hide lineups' : 'Show lineups'}
          <svg
            className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Rendered only while open rather than hidden with CSS: six expanded
          matchups is ~180 player rows, and keeping the collapsed ones out of
          the DOM entirely keeps the gameday phone view cheap to re-render on
          each 60s refresh. */}
      {isExpanded && (
        <div id={panelId} className="px-4 pb-4">
          <MatchupLineupPanel matchup={matchup} startingSlots={startingSlots} week={week} />
        </div>
      )}
    </div>
  );
}
