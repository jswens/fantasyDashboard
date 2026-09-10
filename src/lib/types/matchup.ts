// Weekly matchup / scoreboard shapes.
//
// Built by src/lib/services/matchups.ts from Sleeper's
// GET /league/{id}/matchups/{week} joined against the cap values already on
// Team.roster[] (see src/lib/services/fantasy-data.ts).
//
// Efficiency here is always points per $1M of cap ("PPM"), never points per
// raw dollar -- at a ~$201M cap the latter is ~0.0000005 and unreadable. See
// src/lib/utils/efficiency.ts for the metric and the zero-cap rules.

export interface MatchupPlayer {
  player_id: string;
  full_name: string;
  // The player's own position (QB, RB, DL, ...).
  position: string;
  // NFL team abbreviation, null for players without one.
  nfl_team: string | null;
  // The roster slot this player filled ('QB', 'SUPER_FLEX', 'IDP_FLEX', ...),
  // or null when they were on the bench.
  slot: string | null;
  slot_index: number | null;
  is_starter: boolean;
  cap_value: number;
  points: number;
  // Points per $1M of cap. null when cap_value is 0 -- see efficiency.ts.
  ppm: number | null;
  // True when this player scored but wasn't on the cached roster (mid-week
  // waiver claim, cache lag). cap_value is 0 and unreliable for these.
  cap_unknown: boolean;
}

export interface MatchupSide {
  // roster_id.toString() -- matches Team.team_id.
  team_id: string;
  team_name: string;
  owner_name: string;
  avatar_url: string | null;
  points: number;
  bench_points: number;
  // Sum of cap_value across STARTERS only. This is the "cap space used"
  // figure the weekly awards are defined against -- bench is excluded.
  active_cap: number;
  // Whole roster, for reference against Team.salary_used.
  roster_cap: number;
  // points / (active_cap / 1M). null when active_cap is 0.
  ppm: number | null;
  players: MatchupPlayer[];
}

export interface WeekMatchup {
  matchup_id: number;
  sides: [MatchupSide, MatchupSide];
  // Absolute point difference between the two sides.
  margin: number;
  // team_id of the side currently ahead, null when tied.
  leader_team_id: string | null;
}

export interface WeekScoreboard {
  season: string;
  week: number;
  // The league's current week per GET /state/nfl, so the UI can tell a live
  // week from a completed or upcoming one without a second request.
  current_week: number;
  // Last week of the regular season (playoff_week_start - 1).
  last_regular_season_week: number;
  // The league's starting slots in order, i.e. roster_positions minus 'BN'.
  // MatchupPlayer.slot_index indexes into this. Shipped with the scoreboard so
  // the lineup UI renders the league's actual slots rather than a hardcoded
  // copy that silently drifts if roster_positions ever changes.
  starting_slots: string[];
  matchups: WeekMatchup[];
  // Sides Sleeper returned with no matchup_id. Shouldn't happen in a 12-team
  // league, but dropping them silently would hide a real data problem.
  unmatched: MatchupSide[];
  fetched_at: string;
  // The week has rolled over, so scores are complete (modulo stat corrections).
  is_final: boolean;
  // Sleeper was unreachable and this is the previous good build.
  stale: boolean;
}
