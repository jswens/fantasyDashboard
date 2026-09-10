import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { WeekScoreboard } from '@/lib/types/matchup';

// One doc per league+week rather than one doc per season (or a single doc for
// everything) -- a scoreboard is only ever read/written for one week at a
// time, and this keeps a rebuild of week N from touching week N-1's cache.
//
// Keyed by league id, not season, for two reasons. Sleeper issues a new league
// id every season, so the id already identifies the season uniquely; and the
// season from /state/nfl rolls over to the next year while a league is still
// finishing its own season, which would file January's reads and writes under
// the wrong season. The league id has neither problem, and -- because it comes
// from env rather than the network -- it also lets the cache be checked
// without a Sleeper call first.
function cacheDocId(leagueId: string, week: number): string {
  return `cache/matchups_${leagueId}_${week}`;
}

// Longer than TeamCacheService's 30s window: live scores move slowly enough
// that the point of this window isn't "keep scores current," it's "keep one
// page load from hitting Sleeper once per API route."
export const DEFAULT_MATCHUP_FRESHNESS_WINDOW_SECONDS = 60;

export interface CachedScoreboard {
  scoreboard: WeekScoreboard | null;
  cachedAt: Date | null;
}

export class MatchupCacheService {
  private freshnessWindow: number;

  constructor(freshnessWindowSeconds: number = DEFAULT_MATCHUP_FRESHNESS_WINDOW_SECONDS) {
    this.freshnessWindow = freshnessWindowSeconds * 1000;
  }

  // Returns whatever is cached regardless of age -- stale data always beats
  // no data, so this never withholds a cached build.
  async loadCachedScoreboard(leagueId: string, week: number): Promise<CachedScoreboard> {
    try {
      const doc = await adminDb.doc(cacheDocId(leagueId, week)).get();
      if (!doc.exists) return { scoreboard: null, cachedAt: null };

      const data = doc.data();
      if (!data?.scoreboard) return { scoreboard: null, cachedAt: null };

      const cachedAt = (data.cachedAt as Timestamp | undefined)?.toDate?.() ?? null;
      return { scoreboard: data.scoreboard as WeekScoreboard, cachedAt };
    } catch (error) {
      console.error('Error loading scoreboard from Firestore cache:', error);
      return { scoreboard: null, cachedAt: null };
    }
  }

  isFresh(cachedAt: Date | null): boolean {
    if (!cachedAt) return false;
    return Date.now() - cachedAt.getTime() <= this.freshnessWindow;
  }

  // Returns the timestamp written (null on failure). A concrete Timestamp
  // rather than serverTimestamp() so the value reported as "last refreshed"
  // is on the same clock as the Date.now() freshness checks above.
  async saveScoreboard(leagueId: string, week: number, scoreboard: WeekScoreboard): Promise<Date | null> {
    const cachedAt = new Date();
    try {
      await adminDb.doc(cacheDocId(leagueId, week)).set({
        scoreboard,
        cachedAt: Timestamp.fromDate(cachedAt),
      });
      return cachedAt;
    } catch (error) {
      console.error('Error saving scoreboard to Firestore cache:', error);
      return null;
    }
  }
}
