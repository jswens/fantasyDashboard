import { DataProcessor } from './data-processor';
import { SleeperService } from './sleeper-api';
import { TeamCacheService } from './team-cache';
import { getLeagueSalaryCap } from './league-settings';
import { Team, League } from '@/lib/types';

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
    this.teamCache = new TeamCacheService(60); // Cache for 60 minutes
  }

  async getLeagueData(): Promise<League | null> {
    return await this.sleeperService.getLeague();
  }

  async getAllTeams(): Promise<Team[]> {
    try {
      // First, try to load from cache
      const cachedTeams = await this.teamCache.loadTeamsFromCache();
      if (cachedTeams) {
        console.log('Using cached team data');
        return cachedTeams;
      }

      console.log('Cache miss, generating fresh team data');

      // First, process players with cap numbers from local files
      const processedPlayers = await this.dataProcessor.processPlayersWithCapNumbers();

      if (!processedPlayers) {
        console.error('Failed to process players with cap numbers');
        return [];
      }

      // While the league is pre_draft, the rosters endpoint still reflects last
      // season's teams, so build from draft picks (keepers + live picks) instead.
      const [league, { salaryCap }] = await Promise.all([
        this.sleeperService.getLeague(),
        getLeagueSalaryCap(),
      ]);
      const teams = league?.status === 'pre_draft' && league.draft_id
        ? await this.sleeperService.buildTeamDataFromDraft(processedPlayers, league.draft_id, salaryCap)
        : await this.sleeperService.buildTeamData(processedPlayers, salaryCap);

      // Save to cache for future requests
      if (teams.length > 0) {
        await this.teamCache.saveTeamsToCache(teams);
      }
      
      return teams;
    } catch (error) {
      console.error('Error getting all teams:', error);
      
      // Fallback to cache even if expired
      const cachedTeams = await this.teamCache.loadTeamsFromCache();
      if (cachedTeams) {
        console.log('Using expired cache as fallback');
        return cachedTeams;
      }
      
      return [];
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

      // Clear team cache to force rebuild
      await this.teamCache.clearCache();
      
      // Rebuild team data with fresh player data
      const teams = await this.getAllTeams();
      
      console.log(`Force refresh completed, rebuilt ${teams.length} teams`);
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
      
      // Clear existing cache
      await this.teamCache.clearCache();
      
      // Force fresh data generation
      const teams = await this.getAllTeams();
      
      return teams.length > 0;
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
