// The 32 NFL team abbreviations used throughout the app (matches Sleeper's
// convention — see data/players.json). A player's `team` field is either one
// of these or null (free agent / no NFL team).

export const NFL_TEAMS = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN',
  'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC', 'LAC', 'LAR', 'LV', 'MIA',
  'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB',
  'TEN', 'WAS',
] as const;

export type NFLTeam = typeof NFL_TEAMS[number];

export function isValidNFLTeam(value: string): value is NFLTeam {
  return (NFL_TEAMS as readonly string[]).includes(value);
}
