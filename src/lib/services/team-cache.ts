import fs from 'fs';
import path from 'path';
import { Team } from '@/lib/types';

export class TeamCacheService {
  private cacheFilePath: string;
  private cacheDuration: number; // in milliseconds

  constructor(cacheDurationMinutes: number = 60) {
    this.cacheFilePath = path.join(process.cwd(), 'data', 'teams-cache.json');
    this.cacheDuration = cacheDurationMinutes * 60 * 1000;
  }

  /**
   * Load teams from cache file
   */
  async loadTeamsFromCache(): Promise<Team[] | null> {
    try {
      if (!fs.existsSync(this.cacheFilePath)) {
        console.log('Cache file does not exist');
        return null;
      }

      const stats = fs.statSync(this.cacheFilePath);
      const now = Date.now();
      const fileAge = now - stats.mtime.getTime();

      // Check if cache is expired
      if (fileAge > this.cacheDuration) {
        console.log('Cache expired, age:', Math.round(fileAge / 1000 / 60), 'minutes');
        return null;
      }

      const cacheData = fs.readFileSync(this.cacheFilePath, 'utf8');
      const teams: Team[] = JSON.parse(cacheData);
      
      console.log(`Loaded ${teams.length} teams from cache`);
      return teams;
    } catch (error) {
      console.error('Error loading teams from cache:', error);
      return null;
    }
  }

  /**
   * Save teams to cache file
   */
  async saveTeamsToCache(teams: Team[]): Promise<boolean> {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.cacheFilePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      fs.writeFileSync(this.cacheFilePath, JSON.stringify(teams, null, 2));
      console.log(`Saved ${teams.length} teams to cache`);
      return true;
    } catch (error) {
      console.error('Error saving teams to cache:', error);
      return false;
    }
  }

  /**
   * Clear the cache file
   */
  async clearCache(): Promise<boolean> {
    try {
      if (fs.existsSync(this.cacheFilePath)) {
        fs.unlinkSync(this.cacheFilePath);
        console.log('Cache cleared');
      }
      return true;
    } catch (error) {
      console.error('Error clearing cache:', error);
      return false;
    }
  }

  /**
   * Check if cache exists and is valid
   */
  async isCacheValid(): Promise<boolean> {
    try {
      if (!fs.existsSync(this.cacheFilePath)) {
        return false;
      }

      const stats = fs.statSync(this.cacheFilePath);
      const now = Date.now();
      const fileAge = now - stats.mtime.getTime();

      return fileAge <= this.cacheDuration;
    } catch (error) {
      console.error('Error checking cache validity:', error);
      return false;
    }
  }

  /**
   * Get cache metadata
   */
  async getCacheInfo(): Promise<{
    exists: boolean;
    valid: boolean;
    ageMinutes: number;
    teamCount: number;
  } | null> {
    try {
      if (!fs.existsSync(this.cacheFilePath)) {
        return {
          exists: false,
          valid: false,
          ageMinutes: 0,
          teamCount: 0
        };
      }

      const stats = fs.statSync(this.cacheFilePath);
      const now = Date.now();
      const fileAge = now - stats.mtime.getTime();
      const ageMinutes = Math.round(fileAge / 1000 / 60);
      const isValid = fileAge <= this.cacheDuration;

      const cacheData = fs.readFileSync(this.cacheFilePath, 'utf8');
      const teams: Team[] = JSON.parse(cacheData);

      return {
        exists: true,
        valid: isValid,
        ageMinutes: ageMinutes,
        teamCount: teams.length
      };
    } catch (error) {
      console.error('Error getting cache info:', error);
      return null;
    }
  }

  /**
   * Update a specific team in cache
   */
  async updateTeamInCache(updatedTeam: Team): Promise<boolean> {
    try {
      const teams = await this.loadTeamsFromCache();
      if (!teams) {
        console.log('No cache to update');
        return false;
      }

      const teamIndex = teams.findIndex(team => team.team_id === updatedTeam.team_id);
      if (teamIndex === -1) {
        console.log('Team not found in cache');
        return false;
      }

      teams[teamIndex] = updatedTeam;
      return await this.saveTeamsToCache(teams);
    } catch (error) {
      console.error('Error updating team in cache:', error);
      return false;
    }
  }

  /**
   * Add or update multiple teams in cache
   */
  async updateTeamsInCache(updatedTeams: Team[]): Promise<boolean> {
    try {
      const existingTeams = await this.loadTeamsFromCache() || [];
      
      // Create a map for faster lookups
      const teamMap = new Map(existingTeams.map(team => [team.team_id, team]));
      
      // Update or add teams
      updatedTeams.forEach(team => {
        teamMap.set(team.team_id, team);
      });
      
      const finalTeams = Array.from(teamMap.values());
      return await this.saveTeamsToCache(finalTeams);
    } catch (error) {
      console.error('Error updating teams in cache:', error);
      return false;
    }
  }
}
