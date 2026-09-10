import TeamLogo from '@/components/common/TeamLogo';
import { MatchupSide } from '@/lib/types/matchup';
import { formatCapCompact, formatPoints, formatPpm } from '@/lib/utils/efficiency';
import { PPM_TOOLTIP, PPM_UNIT_LABEL } from './constants';

interface MatchupSideCardProps {
  side: MatchupSide;
  isLeader: boolean;
  isUpcoming: boolean;
}

// One side of a scoreboard-list matchup card. Upcoming weeks hide score and
// PPM entirely rather than showing "0.00" -- Sleeper returns the pairing
// with zero points before kickoff, and a 0.00 PPM reads as a real (if bad)
// performance figure instead of "hasn't happened yet".
export default function MatchupSideCard({ side, isLeader, isUpcoming }: MatchupSideCardProps) {
  return (
    <div
      className={`rounded-lg p-3 ${
        isLeader ? 'bg-sleeper-teal-muted ring-1 ring-sleeper-teal/40' : 'bg-sleeper-bg/40'
      }`}
    >
      <div className="flex items-center gap-3">
        <TeamLogo avatarUrl={side.avatar_url} teamName={side.team_name} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-sleeper-text">{side.team_name}</p>
          <p className="truncate text-xs text-sleeper-muted">{side.owner_name}</p>
        </div>
        {!isUpcoming && (
          <p className={`flex-shrink-0 text-xl font-bold ${isLeader ? 'text-sleeper-teal' : 'text-sleeper-text'}`}>
            {formatPoints(side.points)}
          </p>
        )}
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-sleeper-muted">
        <span>Active cap {formatCapCompact(side.active_cap)}</span>
        {!isUpcoming && (
          <span title={PPM_TOOLTIP}>
            {formatPpm(side.ppm)} {PPM_UNIT_LABEL}
          </span>
        )}
      </div>
    </div>
  );
}
