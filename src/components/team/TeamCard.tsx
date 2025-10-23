import Link from 'next/link';
import { Team } from '@/lib/types';
import { formatIntAsCurrency, getCapStatusColor, getCapStatusText } from '@/lib/utils/formatters';

interface TeamCardProps {
  team: Team;
  onClick?: () => void;
}

export default function TeamCard({ team, onClick }: TeamCardProps) {
  const capPercentage = (team.salary_used / team.salary_cap) * 100;
  const isOverCap = team.salary_used > team.salary_cap;
  
  const cardContent = (
    <div 
      className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer h-full"
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{team.team_name}</h3>
          <p className="text-sm text-gray-600">{team.owner_name}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900">
            {team.roster_size} players
          </p>
          <p className="text-xs text-gray-500">
            {team.wins}-{team.losses}-{team.ties}
          </p>
        </div>
      </div>
      
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span>Salary Cap Usage</span>
          <span>{Math.round(capPercentage)}%</span>
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
          <p className="text-sm text-gray-600">Cap Used</p>
          <p className="font-semibold">{formatIntAsCurrency(team.salary_used)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">Status</p>
          <p className={`font-semibold ${isOverCap ? 'text-red-600' : 'text-green-600'}`}>
            {getCapStatusText(team.salary_used, team.salary_cap)}
          </p>
        </div>
      </div>
      
      {/* Click indicator */}
      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-center text-xs text-gray-500">
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
