import TeamLogo from '@/components/common/TeamLogo';
import { MatchupSide } from '@/lib/types/matchup';
import {
  costPerPoint,
  formatCapCompact,
  formatCostPerPoint,
  formatPoints,
  formatPpm,
} from '@/lib/utils/efficiency';
import { PPM_TOOLTIP, PPM_UNIT_LABEL } from './constants';

interface SideSummaryHeaderProps {
  side: MatchupSide;
  isLeader: boolean;
}

// Detailed per-side header for the drill-in page: identity plus the four
// summary figures the spec calls for (points, active cap, team PPM,
// cost-per-point). MatchupSideCard covers the compact scoreboard-list case;
// this one has room to label every stat instead of packing them inline.
export default function SideSummaryHeader({ side, isLeader }: SideSummaryHeaderProps) {
  const cost = costPerPoint(side.points, side.active_cap);

  return (
    <div
      className={`rounded-xl border p-4 ${
        isLeader ? 'border-sleeper-teal/50 bg-sleeper-teal-muted' : 'border-sleeper-border bg-sleeper-surface'
      }`}
    >
      <div className="flex items-center gap-3">
        <TeamLogo avatarUrl={side.avatar_url} teamName={side.team_name} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-sleeper-text">{side.team_name}</p>
          <p className="truncate text-sm text-sleeper-muted">{side.owner_name}</p>
        </div>
        <p className={`flex-shrink-0 text-3xl font-bold ${isLeader ? 'text-sleeper-teal' : 'text-sleeper-text'}`}>
          {formatPoints(side.points)}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-xs text-sleeper-faint">Active cap</p>
          <p className="text-sm font-semibold text-sleeper-text">{formatCapCompact(side.active_cap)}</p>
        </div>
        <div>
          <p className="text-xs text-sleeper-faint">Team PPM</p>
          <p className="text-sm font-semibold text-sleeper-text" title={PPM_TOOLTIP}>
            {formatPpm(side.ppm)} <span className="text-sleeper-faint">{PPM_UNIT_LABEL}</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-sleeper-faint">Cost / pt</p>
          <p className="text-sm font-semibold text-sleeper-text">{formatCostPerPoint(cost)}</p>
        </div>
        <div>
          <p className="text-xs text-sleeper-faint">Bench pts</p>
          <p className="text-sm font-semibold text-sleeper-text">{formatPoints(side.bench_points)}</p>
        </div>
      </div>
    </div>
  );
}
