// Types for direct player editing (name/team/cap hit) with an audit trail.
// New file per project constraints — do not add these types to src/lib/types/index.ts.
//
// Replaces the old capNumbers/{season}/overrides/{playerId} layering: commissioners
// now edit the players/{playerId} Firestore doc directly, and every change is
// appended to that doc's audit_history. See src/lib/services/player-edit.ts.

import type { SleeperPlayer } from './sleeper';

export type PlayerEditableField = 'first_name' | 'last_name' | 'team' | 'cap_value';

/** One entry in a player's audit_history array. */
export interface PlayerAuditEntry {
  uid: string;
  email: string;
  changedAt: unknown; // Firestore Timestamp
  field: PlayerEditableField;
  previousValue: string | number | null;
  newValue: string | number | null;
  source: 'manual-edit' | 'season-import';
}

/** Body for PATCH /api/players/[playerId]. Only include fields being changed. */
export interface PlayerEditRequest {
  first_name?: string;
  last_name?: string;
  team?: string | null;
  cap_value?: number;
}

/** Document shape at players/{playerId}, as returned to the client. */
export interface PlayerDetail extends SleeperPlayer {
  cap_value: number;
  cap_value_formatted: string;
  search_name: string;
  has_zero_cap_warning: boolean;
  edited_fields: PlayerEditableField[];
  audit_history: PlayerAuditEntry[];
  isRostered: boolean;
  rosterTeamName?: string;
}

export interface PlayerDetailResponse {
  success: boolean;
  message: string;
  data?: PlayerDetail;
}

export interface PlayerEditResponse {
  success: boolean;
  message: string;
  data?: PlayerDetail;
}
