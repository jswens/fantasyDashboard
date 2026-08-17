import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { Team } from '@/lib/types';

const CACHE_DOC = 'cache/teams';

export class TeamCacheService {
  private cacheDuration: number;

  constructor(cacheDurationMinutes: number = 60) {
    this.cacheDuration = cacheDurationMinutes * 60 * 1000;
  }

  async loadTeamsFromCache(): Promise<Team[] | null> {
    try {
      const doc = await adminDb.doc(CACHE_DOC).get();
      if (!doc.exists) return null;

      const data = doc.data();
      if (!data?.cachedAt || !data?.teams) return null;

      const cachedAt: Timestamp = data.cachedAt;
      const ageMs = Date.now() - cachedAt.toMillis();
      if (ageMs > this.cacheDuration) {
        console.log('Firestore cache expired, age:', Math.round(ageMs / 1000 / 60), 'minutes');
        return null;
      }

      console.log(`Loaded ${data.teams.length} teams from Firestore cache`);
      return data.teams as Team[];
    } catch (error) {
      console.error('Error loading teams from Firestore cache:', error);
      return null;
    }
  }

  async saveTeamsToCache(teams: Team[]): Promise<boolean> {
    try {
      await adminDb.doc(CACHE_DOC).set({
        teams,
        cachedAt: FieldValue.serverTimestamp(),
      });
      console.log(`Saved ${teams.length} teams to Firestore cache`);
      return true;
    } catch (error) {
      console.error('Error saving teams to Firestore cache:', error);
      return false;
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
    try {
      const doc = await adminDb.doc(CACHE_DOC).get();
      if (!doc.exists) return false;
      const data = doc.data();
      if (!data?.cachedAt) return false;
      const ageMs = Date.now() - (data.cachedAt as Timestamp).toMillis();
      return ageMs <= this.cacheDuration;
    } catch {
      return false;
    }
  }

  async getCacheInfo(): Promise<{
    exists: boolean;
    valid: boolean;
    ageMinutes: number;
    teamCount: number;
  } | null> {
    try {
      const doc = await adminDb.doc(CACHE_DOC).get();
      if (!doc.exists) {
        return { exists: false, valid: false, ageMinutes: 0, teamCount: 0 };
      }
      const data = doc.data();
      if (!data?.cachedAt) {
        return { exists: true, valid: false, ageMinutes: 0, teamCount: 0 };
      }
      const ageMs = Date.now() - (data.cachedAt as Timestamp).toMillis();
      const ageMinutes = Math.round(ageMs / 1000 / 60);
      return {
        exists: true,
        valid: ageMs <= this.cacheDuration,
        ageMinutes,
        teamCount: data.teams?.length ?? 0,
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
    return this.saveTeamsToCache(teams);
  }

  async updateTeamsInCache(updatedTeams: Team[]): Promise<boolean> {
    const existing = await this.loadTeamsFromCache() ?? [];
    const map = new Map(existing.map(t => [t.team_id, t]));
    updatedTeams.forEach(t => map.set(t.team_id, t));
    return this.saveTeamsToCache(Array.from(map.values()));
  }
}
