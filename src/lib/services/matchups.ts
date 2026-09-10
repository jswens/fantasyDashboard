// Builds WeekScoreboard (see src/lib/types/matchup.ts) from Sleeper's weekly
// matchups endpoint, joined against the cap values already on Team.roster[]
// (see fantasy-data.ts). Caching/resilience mirrors FantasyDataService:
// check Firestore cache first, coalesce concurrent rebuilds, and never let a
// failed rebuild wipe out a previously good scoreboard.

import { SleeperService } from './sleeper-api';
import { FantasyDataService } from './fantasy-data';
import { MatchupCacheService } from './matchup-cache';
import { pointsPerMillion } from '@/lib/utils/efficiency';
import { Team, Player, League } from '@/lib/types';
import { WeekScoreboard, WeekMatchup, MatchupSide, MatchupPlayer } from '@/lib/types/matchup';
import { SleeperMatchup, SleeperNflState } from '@/lib/types/sleeper';

// Used only when a league has never set (or has an invalid) playoff_week_start.
const DEFAULT_LAST_REGULAR_SEASON_WEEK = 14;

// Only reached if Sleeper's /state/nfl endpoint is unreachable on the very
// first request this process ever makes -- i.e. there's no cached scoreboard
// under any season yet to fall back to either. Good enough to avoid crashing;
// the next successful call re-resolves the real season and self-corrects.
const FALLBACK_SEASON = String(new Date().getFullYear());

// Keyed by `${leagueId}_${week}` rather than instance scope: API routes each
// construct their own MatchupService, and one page load fans out into
// several routes (current week + maybe a specific week). Sharing the
// in-flight rebuild means that load results in a single Sleeper pull per week.
const inFlightRebuilds = new Map<string, Promise<{ scoreboard: WeekScoreboard; cachedAt: Date } | null>>();

export class MatchupService {
  private sleeperService: SleeperService;
  private matchupCache: MatchupCacheService;
  private leagueId: string;

  constructor() {
    const leagueId = process.env.NEXT_PUBLIC_SLEEPER_LEAGUE_ID;
    if (!leagueId) {
      throw new Error('NEXT_PUBLIC_SLEEPER_LEAGUE_ID environment variable is required');
    }

    this.leagueId = leagueId;
    this.sleeperService = new SleeperService(leagueId);
    this.matchupCache = new MatchupCacheService(); // 60s coalescing window, see MatchupCacheService
  }

  async getCurrentWeekScoreboard(): Promise<WeekScoreboard> {
    // The only call that genuinely needs /state/nfl up front: we can't look up
    // a week's cache until we know which week is current. It's handed down to
    // getScoreboard so the rebuild doesn't fetch the same thing again.
    const state = await this.sleeperService.getNflState();
    // No cache to consult for the week number itself (that lookup needs a week
    // first) -- default to week 1 and let getScoreboard take over from there.
    const week = state?.week ?? 1;
    return this.getScoreboard(week, state);
  }

  // Never throws: every failure path below falls back to cached data, and
  // only an empty cache produces the empty/stale scoreboard at the bottom.
  async getScoreboard(week: number, knownState?: SleeperNflState | null): Promise<WeekScoreboard> {
    // Cache is keyed by league id, which comes from env -- so a warm cache is
    // served without any Sleeper call at all. The season is resolved from the
    // league during a rebuild instead (see buildAndCacheScoreboard).
    const cached = await this.matchupCache.loadCachedScoreboard(this.leagueId, week);
    if (cached.scoreboard && this.matchupCache.isFresh(cached.cachedAt)) {
      return cached.scoreboard;
    }

    const fresh = await this.rebuildCoalesced(week, knownState, cached.scoreboard);
    if (fresh) {
      return fresh.scoreboard;
    }

    const season = cached.scoreboard?.season ?? knownState?.season ?? FALLBACK_SEASON;

    if (cached.scoreboard) {
      console.warn(
        `Matchup rebuild failed for ${season} week ${week}; serving cached scoreboard from ${cached.cachedAt?.toISOString() ?? 'unknown time'}`
      );
      return { ...cached.scoreboard, stale: true };
    }

    console.error(`Matchup rebuild failed for ${season} week ${week} and no cache exists`);
    return {
      season,
      week,
      current_week: knownState?.week ?? week,
      last_regular_season_week: DEFAULT_LAST_REGULAR_SEASON_WEEK,
      // Unreachable with a cache present (that path returned above), so there
      // are no slots to carry over -- and no matchups to render them against.
      starting_slots: [],
      matchups: [],
      unmatched: [],
      fetched_at: new Date().toISOString(),
      is_final: false,
      stale: true,
    };
  }

  private rebuildCoalesced(
    week: number,
    knownState: SleeperNflState | null | undefined,
    cachedScoreboard: WeekScoreboard | null
  ): Promise<{ scoreboard: WeekScoreboard; cachedAt: Date } | null> {
    const key = `${this.leagueId}_${week}`;
    let inFlight = inFlightRebuilds.get(key);
    if (!inFlight) {
      inFlight = this.buildAndCacheScoreboard(week, knownState, cachedScoreboard).finally(() => {
        inFlightRebuilds.delete(key);
      });
      inFlightRebuilds.set(key, inFlight);
    }
    return inFlight;
  }

  // Returns null on any failure so the caller can fall back to cached data.
  private async buildAndCacheScoreboard(
    week: number,
    knownState: SleeperNflState | null | undefined,
    cachedScoreboard: WeekScoreboard | null
  ): Promise<{ scoreboard: WeekScoreboard; cachedAt: Date } | null> {
    try {
      const [league, teams, matchups, state] = await Promise.all([
        this.sleeperService.getLeague(),
        new FantasyDataService().getAllTeams(),
        this.sleeperService.getMatchups(week),
        // Skipped entirely when the caller already fetched it.
        knownState !== undefined ? Promise.resolve(knownState) : this.sleeperService.getNflState(),
      ]);

      if (!league) {
        console.error('Sleeper league endpoint unavailable; cannot build scoreboard');
        return null;
      }
      if (!matchups) {
        console.error(`Sleeper matchups unavailable for week ${week}; cannot build scoreboard`);
        return null;
      }
      // FantasyDataService already falls back to its own cache and only
      // returns [] when there's genuinely nothing cached -- a scoreboard
      // built with no cap data at all would be misleading, not just thin,
      // so treat it the same as a Sleeper outage rather than publishing it.
      if (teams.length === 0) {
        console.error('No team data available; cannot build scoreboard');
        return null;
      }

      // The league's own season, not /state/nfl's: the NFL clock rolls over to
      // the next season while a league is still finishing its own, and this
      // value is what the Phase 2 sealed-week snapshots will be filed under.
      const season = league.season;
      const lastRegularSeasonWeek = resolveLastRegularSeasonWeek(league.settings);
      const currentWeek = state?.week ?? cachedScoreboard?.current_week ?? 1;
      // Only trust /state/nfl's week to decide "this week is over" while the
      // NFL clock and the league are still on the same season; once they
      // diverge (January), every week of a finished league season is final.
      const isFinal =
        state && state.season !== season
          ? Number(state.season) > Number(season)
          : currentWeek > week;

      const slots = league.roster_positions.filter(p => p !== 'BN');
      const teamsById = new Map(teams.map(t => [t.team_id, t]));

      const sides = matchups.map(entry => buildSide(entry, slots, teamsById));
      const { matchupsResult, unmatched } = pairSides(matchups, sides);

      const scoreboard: WeekScoreboard = {
        season,
        week,
        current_week: currentWeek,
        last_regular_season_week: lastRegularSeasonWeek,
        starting_slots: slots,
        matchups: matchupsResult,
        unmatched,
        fetched_at: new Date().toISOString(),
        is_final: isFinal,
        stale: false,
      };

      const cachedAt = await this.matchupCache.saveScoreboard(this.leagueId, week, scoreboard);
      return { scoreboard, cachedAt: cachedAt ?? new Date() };
    } catch (error) {
      console.error(`Error building scoreboard for league ${this.leagueId} week ${week}:`, error);
      return null;
    }
  }
}

function resolveLastRegularSeasonWeek(settings: League['settings']): number {
  const raw = settings?.playoff_week_start;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw - 1;
  }
  return DEFAULT_LAST_REGULAR_SEASON_WEEK;
}

// players_points (keyed by player_id, covers bench too) is the source of
// truth. starters_points[i] is only a cross-check -- Sleeper has, in
// practice, let the two disagree slightly after a stat correction.
function resolvePlayerPoints(
  playerId: string,
  playersPoints: Record<string, number>,
  startersPointsValue: number | undefined
): number {
  const fromPlayersPoints = playersPoints[playerId];
  const authoritative =
    typeof fromPlayersPoints === 'number' ? fromPlayersPoints : startersPointsValue ?? 0;

  if (
    typeof fromPlayersPoints === 'number' &&
    typeof startersPointsValue === 'number' &&
    Math.abs(fromPlayersPoints - startersPointsValue) > 0.01
  ) {
    console.warn(
      `players_points/starters_points disagree for player ${playerId} (players_points=${fromPlayersPoints}, starters_points=${startersPointsValue}); using players_points`
    );
  }

  return authoritative;
}

function buildMatchupPlayer(
  playerId: string,
  slot: string | null,
  slotIndex: number | null,
  isStarter: boolean,
  points: number,
  rosterById: Map<string, Player>
): MatchupPlayer {
  const rosterPlayer = rosterById.get(playerId);
  // Missing from the cached roster means a mid-week waiver claim or cache lag
  // -- surface it rather than drop it, but cap_value is unknowable here, not
  // genuinely zero (see MatchupPlayer.cap_unknown).
  const capUnknown = !rosterPlayer;
  const capValue = rosterPlayer?.cap_value ?? 0;

  return {
    player_id: playerId,
    // No separate player-name lookup available here (only rostered players'
    // names are known, via Team.roster) -- falls back to the raw id for the
    // cap_unknown case rather than fabricating a name.
    full_name: rosterPlayer?.full_name ?? playerId,
    position: rosterPlayer?.position ?? 'UNK',
    nfl_team: rosterPlayer?.team ?? null,
    slot,
    slot_index: slotIndex,
    is_starter: isStarter,
    cap_value: capValue,
    points,
    ppm: pointsPerMillion(points, capValue),
    cap_unknown: capUnknown,
  };
}

// slots[i] is the roster_position starters[i] filled. An empty slot arrives
// as the literal string "0" (not null/empty) -- skipped without shifting the
// index, so later starters still line up with their real slot.
function buildSide(entry: SleeperMatchup, slots: string[], teamsById: Map<string, Team>): MatchupSide {
  const team = teamsById.get(entry.roster_id.toString());
  const rosterById = new Map((team?.roster ?? []).map(p => [p.player_id, p]));

  const playersPoints = entry.players_points ?? {};
  const starters = entry.starters ?? [];
  const startersPoints = entry.starters_points ?? [];
  const allPlayerIds = entry.players ?? [];

  const seenStarterIds = new Set<string>();
  const matchupPlayers: MatchupPlayer[] = [];

  // Only the first slots.length starters can be given a slot. Any beyond that
  // are still starters, though: leaving them out of this loop entirely would
  // let the bench pass below pick them up, which would quietly move their cap
  // out of active_cap and their points into bench_points -- the exact figures
  // the weekly awards are defined on. They get a null slot and a warning
  // instead of a wrong bucket.
  if (starters.length > slots.length) {
    console.warn(
      `Week entry for roster ${entry.roster_id} has ${starters.length} starters but the league defines ${slots.length} starting slots; the extras are counted as starters without a slot`
    );
  }

  for (let i = 0; i < starters.length; i++) {
    const playerId = starters[i];
    if (!playerId || playerId === '0') continue;
    // Sleeper has, in odd states, listed the same player id twice across
    // starter slots -- guard against emitting two rows for one player.
    if (seenStarterIds.has(playerId)) continue;
    seenStarterIds.add(playerId);

    const withinSlots = i < slots.length;
    const points = resolvePlayerPoints(playerId, playersPoints, startersPoints[i]);
    matchupPlayers.push(
      buildMatchupPlayer(
        playerId,
        withinSlots ? slots[i] : null,
        withinSlots ? i : null,
        true,
        points,
        rosterById
      )
    );
  }

  // Bench: everything in `players` not already placed as a starter above.
  for (const playerId of allPlayerIds) {
    if (!playerId || playerId === '0' || seenStarterIds.has(playerId)) continue;
    const points = resolvePlayerPoints(playerId, playersPoints, undefined);
    matchupPlayers.push(buildMatchupPlayer(playerId, null, null, false, points, rosterById));
  }

  const activeCap = matchupPlayers
    .filter(p => p.is_starter)
    .reduce((sum, p) => sum + p.cap_value, 0);
  const rosterCap = matchupPlayers.reduce((sum, p) => sum + p.cap_value, 0);
  const benchPoints = matchupPlayers
    .filter(p => !p.is_starter)
    .reduce((sum, p) => sum + p.points, 0);
  // Sleeper displays custom_points (a commissioner override) over points when set.
  const sidePoints = entry.custom_points ?? entry.points;

  return {
    team_id: entry.roster_id.toString(),
    team_name: team?.team_name ?? 'Unknown Team',
    owner_name: team?.owner_name ?? '',
    avatar_url: team?.avatar_url ?? null,
    points: sidePoints,
    bench_points: benchPoints,
    active_cap: activeCap,
    roster_cap: rosterCap,
    ppm: pointsPerMillion(sidePoints, activeCap),
    players: matchupPlayers,
  };
}

// Groups sides by matchup_id. Exactly two sides per group is the normal case;
// anything else (a bye, a duplicate, a bad matchup_id) is a data anomaly --
// rather than crash or invent an opponent, those sides go to `unmatched` and
// get logged so a real problem doesn't disappear silently.
function pairSides(
  entries: SleeperMatchup[],
  sides: MatchupSide[]
): { matchupsResult: WeekMatchup[]; unmatched: MatchupSide[] } {
  const groups = new Map<number, MatchupSide[]>();
  const unmatched: MatchupSide[] = [];

  entries.forEach((entry, idx) => {
    const side = sides[idx];
    // Not `=== null`: Sleeper omits matchup_id entirely for some entries, and
    // `undefined` would otherwise group under its own key and produce a
    // matchup with matchup_id undefined -- which sorts as NaN and generates a
    // /matchups/{week}/undefined link.
    if (typeof entry.matchup_id !== 'number' || !Number.isFinite(entry.matchup_id)) {
      unmatched.push(side);
      return;
    }
    const group = groups.get(entry.matchup_id) ?? [];
    group.push(side);
    groups.set(entry.matchup_id, group);
  });

  const matchupsResult: WeekMatchup[] = [];

  for (const [matchupId, group] of groups) {
    if (group.length !== 2) {
      console.warn(`Matchup ${matchupId} has ${group.length} side(s) (expected 2); moving to unmatched`);
      unmatched.push(...group);
      continue;
    }

    // Ordered by team_id, NOT by score. Ordering by score looks stable on a
    // finished week but swaps the two sides mid-game the moment the lead
    // changes, so a gameday auto-refresh would visibly flip the columns the
    // reader is watching. Who's ahead is carried by leader_team_id instead.
    const ordered = [...group].sort(
      (a, b) => Number(a.team_id) - Number(b.team_id) || a.team_id.localeCompare(b.team_id)
    ) as [MatchupSide, MatchupSide];

    const margin = Math.abs(ordered[0].points - ordered[1].points);
    // Derived from scores, not from position, now that `ordered` is by team_id.
    const leaderTeamId =
      ordered[0].points === ordered[1].points
        ? null
        : (ordered[0].points > ordered[1].points ? ordered[0] : ordered[1]).team_id;

    matchupsResult.push({
      matchup_id: matchupId,
      sides: ordered,
      margin,
      leader_team_id: leaderTeamId,
    });
  }

  matchupsResult.sort((a, b) => a.matchup_id - b.matchup_id);

  return { matchupsResult, unmatched };
}
