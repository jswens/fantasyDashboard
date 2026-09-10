import Link from 'next/link';
import { WeekMatchup } from '@/lib/types/matchup';
import { formatPoints } from '@/lib/utils/efficiency';
import MatchupSideCard from './MatchupSideCard';

export type MatchupStatus = 'upcoming' | 'live' | 'final';

interface MatchupCardProps {
  matchup: WeekMatchup;
  week: number;
  status: MatchupStatus;
}

export default function MatchupCard({ matchup, week, status }: MatchupCardProps) {
  const [sideA, sideB] = matchup.sides;
  const isUpcoming = status === 'upcoming';

  return (
    <Link
      href={`/matchups/${week}/${matchup.matchup_id}`}
      className="block rounded-xl border border-sleeper-border bg-sleeper-surface p-4 transition-colors hover:border-sleeper-teal/50 hover:bg-sleeper-surface-hover"
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
    </Link>
  );
}
