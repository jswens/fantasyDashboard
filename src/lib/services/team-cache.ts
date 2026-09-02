import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { Team } from '@/lib/types';

const CACHE_DOC = 'cache/teams';

// How long a cached build stays "fresh enough" to serve without going back to
// Sleeper. Deliberately short: a page load should pull new data, but a single
// load fans out into several API routes and must not hit Sleeper once per route.
export const DEFAULT_FRESHNESS_WINDOW_SECONDS = 30;

export interface CachedTeams {
  teams: Team[];
  cachedAt: Date | null;
}

export class TeamCacheService {
  private freshnessWindow: number;

  constructor(freshnessWindowSeconds: number = DEFAULT_FRESHNESS_WINDOW_SECONDS) {
    this.freshnessWindow = freshnessWindowSeconds * 1000;
  }

  // Returns whatever is cached regardless of age, with its age alongside so the
  // caller can decide whether to refresh. Stale data always beats no data, so
  // this never withholds a cached build.
  async loadCachedTeams(): Promise<CachedTeams> {
    try {
      const doc = await adminDb.doc(CACHE_DOC).get();
      if (!doc.exists) return { teams: [], cachedAt: null };

      const data = doc.data();
      if (!data?.teams) return { teams: [], cachedAt: null };

      const cachedAt = (data.cachedAt as Timestamp | undefined)?.toDate?.() ?? null;
      return { teams: data.teams as Team[], cachedAt };
    } catch (error) {
      console.error('Error loading teams from Firestore cache:', error);
      return { teams: [], cachedAt: null };
    }
  }

  async loadTeamsFromCache(): Promise<Team[] | null> {
    const { teams } = await this.loadCachedTeams();
    return teams.length > 0 ? teams : null;
  }

  isFresh(cachedAt: Date | null): boolean {
    if (!cachedAt) return false;
    return Date.now() - cachedAt.getTime() <= this.freshnessWindow;
  }

  // Returns the timestamp written (null on failure). A concrete Timestamp rather
  // than serverTimestamp() so the value we report as "last refreshed" is on the
  // same clock as the Date.now() freshness checks above.
  async saveTeamsToCache(teams: Team[]): Promise<Date | null> {
    const cachedAt = new Date();
    try {
      await adminDb.doc(CACHE_DOC).set({
        teams,
        cachedAt: Timestamp.fromDate(cachedAt),
      });
      console.log(`Saved ${teams.length} teams to Firestore cache`);
      return cachedAt;
    } catch (error) {
      console.error('Error saving teams to Firestore cache:', error);
      return null;
    }
  }

  async clearCache(): Promise<boolean> {
    try {
      await adminDb.doc(CACHE_DOC).delete();
      console.log('Firestore cache cleared');
      return true;
    } catch (error) {
      console.error('Error clearing Firestore cache:', error);
      return false;
    }
  }

  async isCacheValid(): Promise<boolean> {
    const { cachedAt } = await this.loadCachedTeams();
    return this.isFresh(cachedAt);
  }

  async getCacheInfo(): Promise<{
    exists: boolean;
    valid: boolean;
    ageMinutes: number;
    teamCount: number;
    lastUpdated: string | null;
  } | null> {
    try {
      const { teams, cachedAt } = await this.loadCachedTeams();
      if (!cachedAt) {
        return {
          exists: teams.length > 0,
          valid: false,
          ageMinutes: 0,
          teamCount: teams.length,
          lastUpdated: null,
        };
      }
      const ageMinutes = Math.round((Date.now() - cachedAt.getTime()) / 1000 / 60);
      return {
        exists: true,
        valid: this.isFresh(cachedAt),
        ageMinutes,
        teamCount: teams.length,
        lastUpdated: cachedAt.toISOString(),
      };
    } catch (error) {
      console.error('Error getting Firestore cache info:', error);
      return null;
    }
  }

  async updateTeamInCache(updatedTeam: Team): Promise<boolean> {
    const teams = await this.loadTeamsFromCache();
    if (!teams) return false;
    const idx = teams.findIndex(t => t.team_id === updatedTeam.team_id);
    if (idx === -1) return false;
    teams[idx] = updatedTeam;
    return (await this.saveTeamsToCache(teams)) !== null;
  }

  async updateTeamsInCache(updatedTeams: Team[]): Promise<boolean> {
    const existing = await this.loadTeamsFromCache() ?? [];
    const map = new Map(existing.map(t => [t.team_id, t]));
    updatedTeams.forEach(t => map.set(t.team_id, t));
    return (await this.saveTeamsToCache(Array.from(map.values()))) !== null;
  }
}
