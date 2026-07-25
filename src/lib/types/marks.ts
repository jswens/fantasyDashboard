// Types for personal player marks (sleeper / target / avoid).
// Firestore path: users/{uid}/playerMarks/{playerId}
// See DRAFT_AND_SEASON_TOOLS_PLAN.md section 2.4.

export type PlayerMarkType = 'sleeper' | 'target' | 'avoid';

export interface PlayerMark {
  playerId: string;
  mark: PlayerMarkType;
  note?: string;
  season: string;
  updatedAt: string; // ISO timestamp, serialized for the client
}

/** Map of playerId -> mark, as returned by GET /api/user/marks */
export type PlayerMarksMap = Record<string, PlayerMark>;

export interface GetMarksResponse {
  success: boolean;
  message: string;
  marks?: PlayerMarksMap;
  season?: string;
}

export interface SetMarkRequestBody {
  playerId: string;
  /** mark type to set, or null/omitted to clear the mark */
  mark: PlayerMarkType | null;
  note?: string;
  season?: string;
}

export interface SetMarkResponse {
  success: boolean;
  message: string;
  mark?: PlayerMark | null;
}
