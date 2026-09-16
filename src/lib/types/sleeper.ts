// Sleeper API types
export interface SleeperUser {
  user_id: string;
  display_name: string;
  avatar: string | null;
  metadata?: {
    team_name?: string;
    avatar?: string;
  };
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string;
  players?: string[];
  settings?: {
    wins?: number;
    losses?: number;
    ties?: number;
    fpts?: number;
  };
}

export interface SleeperPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  team: string | null;
  position: string;
  years_exp: number | null;
  active: boolean;
}

export interface SleeperDraftPick {
  player_id: string;
  roster_id: number;
  round: number;
  pick_no: number;
  is_keeper: boolean | null;
  // Sleeper's snapshot of the player at pick time (all values are strings).
  metadata?: {
    first_name?: string;
    last_name?: string;
    position?: string;
    team?: string;
  };
}

// One entry from GET /players/nfl, trimmed to the fields we read.
export interface SleeperRawPlayer {
  player_id: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  team?: string | null;
  position?: string | null;
  fantasy_positions?: string[] | null;
  years_exp?: number | null;
  active?: boolean;
}

// GET /league/{id}/matchups/{week} -- one entry per roster for that week, two
// entries per head-to-head matchup (same matchup_id).
export interface SleeperMatchup {
  // null for a roster with no matchup this week (bye, or the week hasn't
  // been scheduled yet).
  matchup_id: number | null;
  roster_id: number;
  points: number;
  // Commissioner-overridden score; when set, this is what Sleeper itself
  // displays instead of `points`.
  custom_points: number | null;
  // Full roster (starters + bench) for this matchup entry.
  players: string[] | null;
  // starters[i] corresponds to the league's roster_positions[i] (after
  // filtering out 'BN'). An empty slot is the literal string "0".
  starters: string[] | null;
  starters_points: number[] | null;
  // Keyed by player_id, covers bench too -- the source of truth for a
  // player's points this week (see MatchupService).
  players_points: Record<string, number> | null;
}

// GET /state/nfl -- NOT league-scoped, Sleeper's global NFL week/season clock.
export interface SleeperNflState {
  week: number;
  season: string;
  season_type: string;
  display_week: number;
}

// Cap numbers data structure
export interface CapNumberRow {
  lookup_key: string;
  name: string;
  position: string;
  salary_cap: string;
  team: string;
  position_group: string;
  abbreviation: string;
  bye_week: string;
}
