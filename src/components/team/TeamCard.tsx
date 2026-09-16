import Link from 'next/link';
import { Team } from '@/lib/types';
import { formatIntAsCurrency, getCapStatusColor, getCapStatusText } from '@/lib/utils/formatters';
import TeamLogo from '@/components/common/TeamLogo';

interface TeamCardProps {
  team: Team;
  onClick?: () => void;
}

export default function TeamCard({ team, onClick }: TeamCardProps) {
  const capPercentage = (team.salary_used / team.salary_cap) * 100;
  const isOverCap = team.salary_used > team.salary_cap;
  const untrackedCount = team.untracked_players?.length ?? 0;
  
  const cardContent = (
    <div
      className="bg-sleeper-surface border border-sleeper-border rounded-xl p-6 hover:border-sleeper-teal/50 hover:bg-sleeper-surface-hover transition-colors cursor-pointer h-full"
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center space-x-3 min-w-0">
          <TeamLogo avatarUrl={team.avatar_url} teamName={team.team_name} size="sm" />
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-sleeper-text truncate">{team.team_name}</h3>
            <p className="text-sm text-sleeper-muted truncate">{team.owner_name}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-medium text-sleeper-text">
            {team.roster_size} players
          </p>
          <p className="text-xs text-sleeper-faint">
            {team.wins}-{team.losses}-{team.ties}
          </p>
        </div>
      </div>

      {untrackedCount > 0 && (
        <p
          className="mb-4 -mt-1 flex items-center gap-1.5 text-xs font-medium text-sleeper-yellow"
          title="On the Sleeper roster but missing from the dashboard's player data, so not in this team's cap total."
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {untrackedCount} player{untrackedCount === 1 ? '' : 's'} not counted
        </p>
      )}

      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1 text-sleeper-muted">
          <span>Salary Cap Usage</span>
          <span className="text-sleeper-text font-medium">{Math.round(capPercentage)}%</span>
        </div>
        <div className="cap-usage-bar">
          <div
            className={`cap-usage-fill ${getCapStatusColor(team.salary_used, team.salary_cap)}`}
            style={{ width: `${Math.min(capPercentage, 100)}%` }}
          />
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-sleeper-muted">Cap Used</p>
          <p className="font-semibold text-sleeper-text">{formatIntAsCurrency(team.salary_used)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-sleeper-muted">Status</p>
          <p className={`font-semibold ${isOverCap ? 'text-sleeper-red' : 'text-sleeper-teal'}`}>
            {getCapStatusText(team.salary_used, team.salary_cap)}
          </p>
        </div>
      </div>

      {/* Click indicator */}
      <div className="mt-4 pt-3 border-t border-sleeper-border flex items-center justify-center text-xs text-sleeper-faint">
        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Click to view details
      </div>
    </div>
  );

  // If there's an onClick handler, use it directly; otherwise, wrap in Link
  if (onClick) {
    return cardContent;
  }

  return (
    <Link href={`/teams/${team.team_id}`} className="block">
      {cardContent}
    </Link>
  );
}
