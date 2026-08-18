export interface League {
  league_id: string;
  name: string;
  season: string;
  settings: Record<string, unknown>;
  roster_positions: string[];
  total_rosters: number;
  status: string;
  sport: string;
  season_type: string;
  draft_id: string | null;
}
