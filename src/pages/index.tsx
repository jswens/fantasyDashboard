import { useState, useEffect } from 'react';
import Head from 'next/head';
import Header from '@/components/common/Header';
import Loading from '@/components/common/Loading';
import { ZeroCapWarning } from '@/components/common/ZeroCapWarning';
import TeamCard from '@/components/team/TeamCard';
import GoogleSignIn from '@/components/auth/GoogleSignIn';
import { useAuth } from '@/lib/hooks/useAuth';
import { Team } from '@/lib/types';

export default function Dashboard() {
  const { user, isCommissioner, loading: authLoading } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [leagueStats, setLeagueStats] = useState<{
    totalTeams: number;
    averageCapUsage: number;
    teamsOverCap: number;
    totalPlayers: number;
    averageTeamValue: number;
    zeroCapWarnings?: {
      zeroCapCount: number;
      totalPlayers: number;
      percentage: number;
    };
  } | null>(null);
  const [cacheInfo, setCacheInfo] = useState<{
    exists: boolean;
    valid: boolean;
    ageMinutes: number;
    teamCount: number;
  } | null>(null);

  const fetchCacheInfo = async () => {
    try {
      const response = await fetch('/api/teams/cache');
      if (response.ok) {
        const info = await response.json();
        setCacheInfo(info);
      }
    } catch (err) {
      console.error('Error fetching cache info:', err);
    }
  };

  const fetchTeams = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/teams');
      
      if (!response.ok) {
        throw new Error('Failed to fetch teams');
      }
      
      const data = await response.json();
      setTeams(data);
      setLastUpdated(new Date());
      
      // Update cache info and league stats
      await fetchCacheInfo();
      await fetchLeagueStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchLeagueStats = async () => {
    try {
      const response = await fetch('/api/league/stats');
      if (response.ok) {
        const stats = await response.json();
        setLeagueStats(stats);
      }
    } catch (err) {
      console.error('Error fetching league stats:', err);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    const initializeDashboard = async () => {
      await fetchTeams();
      await fetchCacheInfo();
      await fetchLeagueStats();
    };
    initializeDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  if (authLoading || loading) {
    return <Loading />;
  }

  if (!user) {
    return <GoogleSignIn user={null} />;
  }

  if (error) {
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
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Use API data if available, fallback to local calculations
  const teamsOverCap = leagueStats?.teamsOverCap ?? teams.filter(team => team.salary_used > team.salary_cap).length;
  const averageCapUsage = leagueStats?.averageCapUsage ?? (teams.length > 0 
    ? teams.reduce((sum, team) => sum + team.salary_used, 0) / teams.length 
    : 0);

  return (
    <div className="min-h-screen bg-sleeper-bg">
      <Head>
        <title>Fantasy League Dashboard</title>
        <meta name="description" content="Fantasy Football League Salary Cap Dashboard" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

        <Header
          title="Fantasy League Dashboard"
          subtitle={cacheInfo ? `Cache: ${cacheInfo.valid ? 'Valid' : 'Expired'} (${cacheInfo.ageMinutes}min old, ${cacheInfo.teamCount} teams)` : undefined}
          lastUpdated={lastUpdated || undefined}
          user={user}
          isCommissioner={isCommissioner}
        />      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
                    <dt className="text-sm font-medium text-sleeper-muted truncate">Total Teams</dt>
                    <dd className="text-lg font-medium text-sleeper-text">{teams.length}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-sleeper-surface border border-sleeper-border overflow-hidden rounded-xl">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-sleeper-red-muted border border-sleeper-red/30 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-sleeper-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-sleeper-muted truncate">Teams Over Cap</dt>
                    <dd className="text-lg font-medium text-sleeper-text">{teamsOverCap}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-sleeper-surface border border-sleeper-border overflow-hidden rounded-xl">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-sleeper-teal-muted border border-sleeper-teal/30 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-sleeper-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-sleeper-muted truncate">Avg Cap Usage</dt>
                    <dd className="text-lg font-medium text-sleeper-text">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      }).format(averageCapUsage)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Zero Cap Warning Card */}
          <div className="bg-sleeper-surface border border-sleeper-border overflow-hidden rounded-xl">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-sleeper-yellow/15 border border-sleeper-yellow/30 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-sleeper-yellow" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-sleeper-muted truncate">Zero Cap Hit Players</dt>
                    <dd className="text-lg font-medium text-sleeper-text">
                      {leagueStats?.zeroCapWarnings?.zeroCapCount || 0}
                      {leagueStats?.zeroCapWarnings && (
                        <span className="text-sm font-normal text-sleeper-faint ml-2">
                          ({leagueStats.zeroCapWarnings.percentage}%)
                        </span>
                      )}
                    </dd>
                  </dl>
                </div>
              </div>
              {leagueStats?.zeroCapWarnings && leagueStats.zeroCapWarnings.zeroCapCount > 0 && (
                <div className="mt-3">
                  <ZeroCapWarning className="text-xs" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Teams Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {teams.map((team) => (
            <TeamCard 
              key={team.team_id} 
              team={team}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
