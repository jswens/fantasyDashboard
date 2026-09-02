import { DataProcessor } from './data-processor';
import { SleeperService } from './sleeper-api';
import { TeamCacheService } from './team-cache';
import { getLeagueSalaryCap } from './league-settings';
import { Team, League } from '@/lib/types';

export interface TeamsResult {
  teams: Team[];
  // When the data being returned was actually pulled from Sleeper.
  lastUpdated: Date | null;
  // True when a refresh was attempted and failed, so this is the previous good
  // build rather than fresh data.
  stale: boolean;
}

// Module scope, not instance scope: API routes each construct their own
// FantasyDataService, and one page load fans out into several routes. Sharing
// the in-flight refresh means that load results in a single Sleeper pull.
let inFlightRefresh: Promise<{ teams: Team[]; cachedAt: Date } | null> | null = null;

export class FantasyDataService {
  private dataProcessor: DataProcessor;
  private sleeperService: SleeperService;
  private teamCache: TeamCacheService;

  constructor() {
    this.dataProcessor = new DataProcessor();

    // Get league ID from environment variable
    const leagueId = process.env.NEXT_PUBLIC_SLEEPER_LEAGUE_ID;
    if (!leagueId) {
      throw new Error('NEXT_PUBLIC_SLEEPER_LEAGUE_ID environment variable is required');
    }

    this.sleeperService = new SleeperService(leagueId);
    this.teamCache = new TeamCacheService(); // ~30s coalescing window, see TeamCacheService
  }

  async getLeagueData(): Promise<League | null> {
    return await this.sleeperService.getLeague();
  }

  async getAllTeams(): Promise<Team[]> {
    return (await this.getTeamsWithMeta()).teams;
  }

  // Pulls fresh data from Sleeper on every request, apart from a short
  // coalescing window that keeps one page load from hitting Sleeper once per
  // API route. If anything about the pull fails we serve the last good build
  // instead of an empty league -- the cache is never discarded for being old.
  async getTeamsWithMeta(): Promise<TeamsResult> {
    const cached = await this.teamCache.loadCachedTeams();

    if (cached.teams.length > 0 && this.teamCache.isFresh(cached.cachedAt)) {
      console.log('Using just-refreshed team data');
      return { teams: cached.teams, lastUpdated: cached.cachedAt, stale: false };
    }

    const fresh = await this.refreshTeamsCoalesced();
    if (fresh) {
      return { teams: fresh.teams, lastUpdated: fresh.cachedAt, stale: false };
    }

    if (cached.teams.length > 0) {
      console.warn(
        `Refresh failed; serving cached teams from ${cached.cachedAt?.toISOString() ?? 'unknown time'}`
      );
      return { teams: cached.teams, lastUpdated: cached.cachedAt, stale: true };
    }

    console.error('Refresh failed and no cached teams exist');
    return { teams: [], lastUpdated: null, stale: true };
  }

  // Concurrent callers share one refresh rather than each starting their own.
  private refreshTeamsCoalesced(): Promise<{ teams: Team[]; cachedAt: Date } | null> {
    if (!inFlightRefresh) {
      inFlightRefresh = this.buildAndCacheTeams().finally(() => {
        inFlightRefresh = null;
      });
    }
    return inFlightRefresh;
  }

  // Returns null on any failure so the caller can fall back to cached data.
  private async buildAndCacheTeams(): Promise<{ teams: Team[]; cachedAt: Date } | null> {
    try {
      console.log('Refreshing team data from Sleeper');

      const processedPlayers = await this.dataProcessor.processPlayersWithCapNumbers();
      if (!processedPlayers) {
        console.error('Failed to process players with cap numbers');
        return null;
      }

      const [league, { salaryCap }] = await Promise.all([
        this.sleeperService.getLeague(),
        getLeagueSalaryCap(),
      ]);

      // A null league means Sleeper is unreachable, not that the league left
      // pre_draft -- falling through would rebuild against the wrong endpoint.
      if (!league) {
        console.error('Sleeper league endpoint unavailable');
        return null;
      }

      // While the league is pre_draft, the rosters endpoint still reflects last
      // season's teams, so build from draft picks (keepers + live picks) instead.
      const teams = league.status === 'pre_draft' && league.draft_id
        ? await this.sleeperService.buildTeamDataFromDraft(processedPlayers, league.draft_id, salaryCap)
        : await this.sleeperService.buildTeamData(processedPlayers, salaryCap);

      if (!teams || teams.length === 0) {
        console.error('Sleeper returned no teams');
        return null;
      }

      const cachedAt = await this.teamCache.saveTeamsToCache(teams);
      return { teams, cachedAt: cachedAt ?? new Date() };
    } catch (error) {
      console.error('Error refreshing team data:', error);
      return null;
    }
  }

  async getTeamById(teamId: string): Promise<Team | null> {
    const teams = await this.getAllTeams();
    return teams.find(team => team.team_id === teamId) || null;
  }

  async refreshPlayerData(): Promise<boolean> {
    try {
      console.log('Refreshing player data from data/players.json...');

      // Create processed players cache with cap numbers
      const processedCacheCreated = await this.dataProcessor.createProcessedPlayersCache();
      if (!processedCacheCreated) {
        console.error('Failed to create processed players cache');
        return false;
      }

      console.log('Player data refresh completed successfully');
      return true;
    } catch (error) {
      console.error('Error refreshing player data:', error);
      return false;
    }
  }

  async forceRefreshAllData(): Promise<boolean> {
    try {
      console.log('Force refreshing all data...');

      // Refresh player data first
      const playerRefresh = await this.refreshPlayerData();
      if (!playerRefresh) {
        return false;
      }

      // Rebuild directly rather than through getAllTeams(), so an admin refresh
      // always hits Sleeper instead of joining an in-flight or just-cached build.
      const rebuilt = await this.buildAndCacheTeams();
      if (!rebuilt) {
        console.error('Force refresh could not rebuild teams; cache left untouched');
        return false;
      }

      console.log(`Force refresh completed, rebuilt ${rebuilt.teams.length} teams`);
      return true;
    } catch (error) {
      console.error('Error force refreshing all data:', error);
      return false;
    }
  }

  async getLeagueStats(): Promise<{
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
  }> {
    const teams = await this.getAllTeams();

    if (teams.length === 0) {
      return {
        totalTeams: 0,
        averageCapUsage: 0,
        teamsOverCap: 0,
        totalPlayers: 0,
        averageTeamValue: 0
      };
    }

    const totalCapUsed = teams.reduce((sum, team) => sum + team.salary_used, 0);
    const averageCapUsage = totalCapUsed / teams.length;
    const teamsOverCap = teams.filter(team => team.salary_used > team.salary_cap).length;
    const totalPlayers = teams.reduce((sum, team) => sum + team.roster_size, 0);
    const averageTeamValue = averageCapUsage;

    // Calculate zero cap warnings only for rostered players
    let rosteredZeroCapCount = 0;
    let totalRosteredPlayers = 0;

    teams.forEach(team => {
      team.roster.forEach(player => {
        totalRosteredPlayers++;
        if (player.cap_value === 0) {
          rosteredZeroCapCount++;
        }
      });
    });

    const zeroCapWarnings = totalRosteredPlayers > 0 ? {
      zeroCapCount: rosteredZeroCapCount,
      totalPlayers: totalRosteredPlayers,
      percentage: Math.round((rosteredZeroCapCount / totalRosteredPlayers) * 100 * 10) / 10
    } : null;

    return {
      totalTeams: teams.length,
      averageCapUsage: Math.round(averageCapUsage),
      teamsOverCap,
      totalPlayers,
      averageTeamValue: Math.round(averageTeamValue),
      zeroCapWarnings: zeroCapWarnings || undefined
    };
  }

  // Helper method to format currency consistently
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  // Helper method to get cap usage percentage
  getCapUsagePercentage(team: Team): number {
    return Math.round((team.salary_used / team.salary_cap) * 100);
  }

  // Helper method to determine if team is over cap
  isTeamOverCap(team: Team): boolean {
    return team.salary_used > team.salary_cap;
  }

  // Cache management methods
  async refreshTeamCache(): Promise<boolean> {
    try {
      console.log('Refreshing team cache...');

      // Only replace the cache once a rebuild succeeds -- clearing first would
      // throw away good data if Sleeper happened to be down.
      const rebuilt = await this.buildAndCacheTeams();
      return rebuilt !== null;
    } catch (error) {
      console.error('Error refreshing team cache:', error);
      return false;
    }
  }

  async getCacheInfo(): Promise<{
    exists: boolean;
    valid: boolean;
    ageMinutes: number;
    teamCount: number;
    lastUpdated: string | null;
  } | null> {
    return await this.teamCache.getCacheInfo();
  }

  async clearTeamCache(): Promise<boolean> {
    return await this.teamCache.clearCache();
  }

  async updateTeamInCache(team: Team): Promise<boolean> {
    return await this.teamCache.updateTeamInCache(team);
  }
}
