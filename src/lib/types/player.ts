export interface Player {
  player_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  position: string;
  team: string | null;
  cap_value: number;
  cap_value_formatted: string;
  years_exp: number | null;
  active: boolean;
  team_id?: string;
  is_rostered: boolean;
  search_name: string;
  has_zero_cap_warning?: boolean;
}
