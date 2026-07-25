// Types for the Sleeper draft endpoints and the merged /api/draft/state response.
// See DRAFT_AND_SEASON_TOOLS_PLAN.md section 2.1.

/** Raw response from GET /v1/league/{league_id}/drafts */
export interface SleeperDraftSummary {
  draft_id: string;
  league_id: string;
  status: 'pre_draft' | 'drafting' | 'paused' | 'complete' | string;
  type: string;
  season: string;
  start_time: number | null;
  created: number;
  last_picked?: number | null;
}

/** Raw response from GET /v1/draft/{draft_id} */
export interface SleeperDraftSettings {
  rounds?: number;
  teams?: number;
  pick_timer?: number;
  [key: string]: unknown;
}

export interface SleeperDraft {
  draft_id: string;
  league_id: string;
  status: string;
  type: string;
  season: string;
  start_time: number | null;
  created: number;
  settings: SleeperDraftSettings;
  /** roster_id (as string) -> draft slot number */
  slot_to_roster_id: Record<string, number> | null;
  /** draft order: user_id -> slot number */
  draft_order: Record<string, number> | null;
  roster_positions?: string[];
  metadata?: Record<string, unknown>;
}

/** Raw response from GET /v1/draft/{draft_id}/picks */
export interface SleeperDraftPick {
  pick_no: number;
  round: number;
  draft_slot: number;
  player_id: string;
  picked_by: string; // user_id, empty string if autopicked/unknown
  roster_id: number | null;
  is_keeper: boolean | null;
  metadata?: {
    first_name?: string;
    last_name?: string;
    position?: string;
    team?: string;
    [key: string]: unknown;
  };
}

// ---- Merged /api/draft/state response ----

export interface DraftStatePlayerInfo {
  player_id: string;
  full_name: string;
  position: string;
  team: string | null;
}

export interface DraftStatePick {
  pick_no: number;
  round: number;
  draft_slot: number;
  roster_id: number | null;
  picked_by: string;
  player: DraftStatePlayerInfo | null;
}

export interface DraftTeamPositionCounts {
  [position: string]: number;
}

export interface DraftTeamSummary {
  roster_id: number | null;
  draft_slot: number | null;
  owner_id: string | null;
  picks_made: number;
  picks_by_position: DraftTeamPositionCounts;
  /** roster_positions slots filled vs. required, keyed by position/slot label */
  roster_slots: {
    position: string;
    required: number;
    filled: number;
  }[];
}

export interface DraftStateResponse {
  success: boolean;
  message: string;
  data?: {
    draft: {
      draft_id: string;
      league_id: string;
      status: string;
      season: string;
      rounds: number | null;
      roster_positions: string[];
      slot_to_roster_id: Record<string, number> | null;
      draft_order: Record<string, number> | null;
    };
    picks: DraftStatePick[];
    totalPicks: number;
    teams: DraftTeamSummary[];
  };
}
