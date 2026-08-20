// Types for the salary cap data pipeline (Workstream 1).
// New file per project constraints — do not add cap types to src/lib/types/index.ts.

/** A single parsed row from an imported cap-hit CSV (OverTheCap export or manual upload). */
export interface CapImportRow {
  /** Raw player name as it appeared in the source file. */
  rawName: string;
  /** Normalized name used for matching against Sleeper players. */
  normalizedName: string;
  team: string;
  position: string;
  /** Cap hit in whole dollars. */
  capHit: number;
}

/** One entry in the imported player -> cap hit map, keyed by Sleeper player_id when matched. */
export interface CapImportEntry {
  rawName: string;
  normalizedName: string;
  team: string;
  position: string;
  capHit: number;
  /** Sleeper player_id this row was matched to, if any. */
  matchedPlayerId: string | null;
}

/** Metadata stored alongside an import at capNumbers/{season}. */
export interface CapImportMetadata {
  season: string;
  source: 'overthecap-csv' | 'manual-csv';
  importedAt: unknown; // Firestore server timestamp (FieldValue on write, Timestamp on read)
  importedBy: string; // uid
  rowCount: number;
  matchedCount: number;
  unmatchedCount: number;
  zeroOrMissingCount: number;
}

/** Document shape at capNumbers/{season}. */
export interface CapImportDocument {
  metadata: CapImportMetadata;
  /** Keyed by Sleeper player_id for matched rows. */
  players: Record<string, CapImportEntry>;
  /** Rows from the source file that could not be matched to a Sleeper player. */
  unmatched: CapImportEntry[];
}

/** Validation report returned by the import endpoint. */
export interface CapImportValidationReport {
  season: string;
  totalRows: number;
  matchedCount: number;
  unmatchedCount: number;
  unmatchedNames: string[];
  zeroOrMissingCapHitPlayers: { name: string; playerId: string | null }[];
  alreadyImported: boolean;
}

export interface CapImportResponse {
  success: boolean;
  message: string;
  report?: CapImportValidationReport;
}

/** Audit trail entry stored alongside the league cap doc. */
export interface LeagueCapAuditEntry {
  uid: string;
  changedAt: unknown; // Firestore server timestamp
  previousValue: number | null;
  newValue: number;
}

/** Document shape at leagueSettings/{season} — the league-wide salary cap. */
export interface LeagueCapDocument {
  season: string;
  salaryCap: number;
  updatedBy: string;
  updatedAt: unknown; // Firestore server timestamp
  previousValue: number | null;
  history: LeagueCapAuditEntry[];
}

export interface LeagueCapRequest {
  season?: string;
  salaryCap: number;
}

export interface LeagueCapInfo {
  season: string;
  salaryCap: number;
  /** True when no commissioner has set a cap for this season yet, and the built-in fallback is in use. */
  isDefault: boolean;
}

export interface LeagueCapResponse {
  success: boolean;
  message: string;
  data?: LeagueCapInfo;
}

/** Result row for GET /api/players/search. */
export interface PlayerSearchResult {
  playerId: string;
  fullName: string;
  team: string | null;
  position: string;
  capHit: number;
  capHitFormatted: string;
  /** True when a commissioner has manually set this player's cap hit (via edit or season import). */
  isManuallyEdited: boolean;
  isRostered: boolean;
  rosterTeamName?: string;
}

export interface PlayerSearchResponse {
  success: boolean;
  message: string;
  data?: PlayerSearchResult[];
  total?: number;
}
