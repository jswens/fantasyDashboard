import { Player } from './player';

export interface Team {
  team_id: string;
  owner_id: string;
  team_name: string;
  owner_name: string;
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
}
