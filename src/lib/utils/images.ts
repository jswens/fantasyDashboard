const SLEEPER_CDN = 'https://sleepercdn.com';

export function getPlayerHeadshotUrl(playerId: string): string {
  return `${SLEEPER_CDN}/content/nfl/players/thumb/${playerId}.jpg`;
}

// avatarId is the raw Sleeper user/roster avatar id (a hash or e.g. "nfl_bal").
export function getTeamAvatarUrl(avatarId: string): string {
  return `${SLEEPER_CDN}/avatars/thumbs/${avatarId}`;
}
