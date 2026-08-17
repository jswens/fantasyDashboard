// Shape of data/players.json — a precomputed Sleeper-pool + cap-sheet join
// (built offline, same methodology as the draft-helper project's
// build_player_data.py). The app trusts this join as-is: no runtime name
// matching. `capHit: null` means genuinely unknown, never coerced to 0.

export type CapSource = 'csv' | 'unknown';

export interface PlayerPoolEntry {
  playerId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  position: string;
  fantasyPositions: string[];
  team: string;
  searchName: string;
  byeWeek: number | null;
  capHit: number | null;
  capSource: CapSource;
  capMatchRule: string | null;
  projection: number | null;
}

export interface PlayerPoolFile {
  generatedAt: string;
  season: string;
  counts: {
    players: number;
    withCapHit: number;
    withProjection: number;
  };
  players: Record<string, PlayerPoolEntry>;
}
