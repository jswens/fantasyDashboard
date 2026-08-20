import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Header from '@/components/common/Header';
import Loading from '@/components/common/Loading';
import { ZeroCapWarning } from '@/components/common/ZeroCapWarning';
import CapByPositionChart from '@/components/team/CapByPositionChart';
import PlayerAvatar from '@/components/common/PlayerAvatar';
import TeamLogo from '@/components/common/TeamLogo';
import PlayerActionsMenu from '@/components/players/PlayerActionsMenu';
import { useAuth } from '@/lib/hooks/useAuth';
import { Team } from '@/lib/types';
import { formatIntAsCurrency } from '@/lib/utils/formatters';

export default function TeamDetail() {
  const router = useRouter();
  const { teamId } = router.query;
  const { user, isAdmin, isCommissioner } = useAuth();
  const canEdit = isAdmin || isCommissioner;
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeamData = useCallback(async () => {
    if (!teamId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Get all teams and find the specific one
      const response = await fetch('/api/teams');
      if (!response.ok) {
        throw new Error('Failed to fetch team data');
      }
      
      const teams: Team[] = await response.json();
      const foundTeam = teams.find(t => t.team_id === teamId);
      
      if (!foundTeam) {
        throw new Error('Team not found');
      }
      
      setTeam(foundTeam);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  if (loading) {
    return <Loading />;
  }

  if (error || !team) {
    return (
      <div className="min-h-screen bg-sleeper-bg">
        <Header />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-sleeper-red-muted border border-sleeper-red/30 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-sleeper-red" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-sleeper-red">Error</h3>
                <div className="mt-2 text-sm text-sleeper-red/80">
                  <p>{error || 'Team not found'}</p>
                </div>
                <div className="mt-4">
                  <Link
                    href="/"
                    className="inline-block bg-sleeper-red/20 px-3 py-1.5 text-sm font-medium text-sleeper-red rounded-full hover:bg-sleeper-red/30 transition-colors"
                  >
                    ← Back to Dashboard
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const capUsagePercentage = (team.salary_used / team.salary_cap) * 100;
  const isOverCap = team.salary_used > team.salary_cap;
  
  // Sort players by cap value (highest first)
  const sortedPlayers = [...team.roster].sort((a, b) => b.cap_value - a.cap_value);

  return (
    <div className="min-h-screen bg-sleeper-bg">
      <Head>
        <title>{team.team_name} - Team Details</title>
        <meta name="description" content={`${team.team_name} roster and salary cap breakdown`} />
      </Head>

      <Header
        title={team.team_name}
        subtitle={`${team.owner_name} • ${team.wins}-${team.losses}-${team.ties}`}
        onRefresh={fetchTeamData}
        user={user}
        isCommissioner={isCommissioner}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Navigation */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center text-sm font-medium text-sleeper-muted hover:text-sleeper-text transition-colors"
          >
            <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
        </div>

        {/* Team Identity */}
        <div className="flex items-center space-x-4 mb-8">
          <TeamLogo avatarUrl={team.avatar_url} teamName={team.team_name} size="lg" />
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-sleeper-text truncate">{team.team_name}</h2>
            <p className="text-sm text-sleeper-muted truncate">
              {team.owner_name} • {team.wins}-{team.losses}-{team.ties}
            </p>
          </div>
        </div>

        {/* Team Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-sleeper-surface border border-sleeper-border overflow-hidden rounded-xl">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-sleeper-teal-muted border border-sleeper-teal/30 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-sleeper-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-sleeper-muted truncate">Roster Size</dt>
                    <dd className="text-lg font-medium text-sleeper-text">{team.roster_size}/{team.max_roster_size}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-sleeper-surface border border-sleeper-border overflow-hidden rounded-xl">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className={`w-8 h-8 ${isOverCap ? 'bg-sleeper-red-muted border border-sleeper-red/30' : 'bg-sleeper-teal-muted border border-sleeper-teal/30'} rounded-md flex items-center justify-center`}>
                    <svg className={`w-5 h-5 ${isOverCap ? 'text-sleeper-red' : 'text-sleeper-teal'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-sleeper-muted truncate">Cap Usage</dt>
                    <dd className="text-lg font-medium text-sleeper-text">{Math.round(capUsagePercentage)}%</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-sleeper-surface border border-sleeper-border overflow-hidden rounded-xl">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-sleeper-purple/15 border border-sleeper-purple/30 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-sleeper-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-sleeper-muted truncate">Cap Used</dt>
                    <dd className="text-lg font-medium text-sleeper-text">{formatIntAsCurrency(team.salary_used)}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-sleeper-surface border border-sleeper-border overflow-hidden rounded-xl">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className={`w-8 h-8 ${team.salary_remaining < 0 ? 'bg-sleeper-red-muted border border-sleeper-red/30' : 'bg-sleeper-teal-muted border border-sleeper-teal/30'} rounded-md flex items-center justify-center`}>
                    <svg className={`w-5 h-5 ${team.salary_remaining < 0 ? 'text-sleeper-red' : 'text-sleeper-teal'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-sleeper-muted truncate">Cap Remaining</dt>
                    <dd className="text-lg font-medium text-sleeper-text">{formatIntAsCurrency(team.salary_remaining)}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Salary Cap Usage Bar */}
        <div className="bg-sleeper-surface border border-sleeper-border rounded-xl p-6 mb-8">
          <h3 className="text-lg font-medium text-sleeper-text mb-4">Salary Cap Usage</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm text-sleeper-muted">
              <span>Used: {formatIntAsCurrency(team.salary_used)}</span>
              <span>Total: {formatIntAsCurrency(team.salary_cap)}</span>
            </div>
            <div className="cap-usage-bar">
              <div
                className={`cap-usage-fill ${isOverCap ? 'bg-sleeper-red' : capUsagePercentage > 90 ? 'bg-sleeper-yellow' : 'bg-sleeper-teal'}`}
                style={{ width: `${Math.min(capUsagePercentage, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-sleeper-faint">
              <span>0%</span>
              <span className={`font-medium ${isOverCap ? 'text-sleeper-red' : 'text-sleeper-text'}`}>
                {Math.round(capUsagePercentage)}%
              </span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* Cap Space by Position Chart */}
        <div className="mb-8">
          <CapByPositionChart 
            players={team.roster} 
            totalCapUsed={team.salary_used} 
          />
        </div>

        {/* Player Roster */}
        <div className="bg-sleeper-surface border border-sleeper-border rounded-xl">
          <div className="px-6 py-4 border-b border-sleeper-border">
            <h3 className="text-lg font-medium text-sleeper-text">Team Roster</h3>
            <p className="text-sm text-sleeper-muted">{team.roster_size} players • Sorted by salary cap hit</p>
          </div>

          {sortedPlayers.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <svg className="mx-auto h-12 w-12 text-sleeper-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-sleeper-text">No players</h3>
              <p className="mt-1 text-sm text-sleeper-muted">This team doesn&apos;t have any players yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-sleeper-border">
              {sortedPlayers.map((player) => {
                const capPercentage = team.salary_cap > 0 ? (player.cap_value / team.salary_cap) * 100 : 0;

                return (
                  <div key={player.player_id} className="px-6 py-4 hover:bg-sleeper-surface-hover transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <PlayerAvatar playerId={player.player_id} fullName={player.full_name} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-sleeper-text">
                            {player.full_name}
                          </p>
                          <div className="flex items-center space-x-4 text-sm text-sleeper-muted">
                            <span className="inline-flex px-2 py-1 text-xs font-medium bg-sleeper-teal-muted text-sleeper-teal rounded-full">
                              {player.position}
                            </span>
                            {player.team && (
                              <span className="inline-flex px-2 py-1 text-xs font-medium bg-sleeper-surface-hover text-sleeper-muted rounded-full">
                                {player.team}
                              </span>
                            )}
                            {player.years_exp !== null && (
                              <span>{player.years_exp} {player.years_exp === 1 ? 'year' : 'years'} exp</span>
                            )}
                          </div>
                          {player.has_zero_cap_warning && (
                            <div className="mt-1">
                              <ZeroCapWarning className="text-xs" />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-sm font-medium text-sleeper-text">
                            {formatIntAsCurrency(player.cap_value)}
                          </p>
                          <p className="text-xs text-sleeper-faint">
                            {capPercentage.toFixed(1)}% of cap
                          </p>
                        </div>

                        <div className="w-20">
                          <div className="cap-usage-bar h-2">
                            <div
                              className={`cap-usage-fill h-2 ${capPercentage > 10 ? 'bg-sleeper-red' : capPercentage > 5 ? 'bg-sleeper-yellow' : 'bg-sleeper-teal'}`}
                              style={{ width: `${Math.max(capPercentage * 2, 2)}%` }}
                            />
                          </div>
                        </div>

                        {canEdit && <PlayerActionsMenu playerId={player.player_id} />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
