import { Player } from './player';

// A player on this team's Sleeper roster with no players/{id} doc, so they're
// missing from `roster` and their cap hit isn't in `salary_used`. Name fields
// are best-effort from Sleeper and null if the lookup failed.
export interface UntrackedRosterPlayer {
  player_id: string;
  full_name: string | null;
  position: string | null;
  nfl_team: string | null;
}

export interface Team {
  team_id: string;
  owner_id: string;
  team_name: string;
  owner_name: string;
  avatar_url: string | null;
  wins: number;
  losses: number;
  ties: number;
  total_points: number;
  roster: Player[];
  salary_cap: number;
  salary_used: number;
  salary_remaining: number;
  roster_size: number;
  max_roster_size: number;
  untracked_players?: UntrackedRosterPlayer[];
}
