// Sleeper API types
export interface SleeperUser {
  user_id: string;
  display_name: string;
  metadata?: {
    team_name?: string;
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
