import { Team, Player, League } from '@/lib/types';
import { SleeperUser, SleeperRoster, SleeperPlayer, SleeperDraftPick, SleeperMatchup, SleeperNflState } from '@/lib/types/sleeper';
import { getTeamAvatarUrl } from '@/lib/utils/images';

function resolveAvatarUrl(user: SleeperUser): string | null {
  if (user.metadata?.avatar) return user.metadata.avatar;
  if (user.avatar) return getTeamAvatarUrl(user.avatar);
  return null;
}

export class SleeperService {
  private baseUrl = 'https://api.sleeper.app/v1';
  private leagueId: string;

  constructor(leagueId: string) {
    this.leagueId = leagueId;
  }

  async getLeague(): Promise<League | null> {
    try {
      const response = await fetch(`${this.baseUrl}/league/${this.leagueId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      return {
        league_id: data.league_id,
        name: data.name,
        season: data.season,
        settings: data.settings || {},
        roster_positions: data.roster_positions || [],
        total_rosters: data.total_rosters,
        status: data.status,
        sport: data.sport,
        season_type: data.season_type,
        draft_id: data.draft_id || null
      };
    } catch (error) {
      console.error('Error fetching league:', error);
      return null;
    }
  }

  async getDraftPicks(draftId: string): Promise<SleeperDraftPick[] | null> {
    try {
      const response = await fetch(`${this.baseUrl}/draft/${draftId}/picks`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching draft picks:', error);
      return null;
    }
  }

  async getUsers(): Promise<SleeperUser[] | null> {
    try {
      const response = await fetch(`${this.baseUrl}/league/${this.leagueId}/users`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching users:', error);
      return null;
    }
  }

  async getRosters(): Promise<SleeperRoster[] | null> {
    try {
      const response = await fetch(`${this.baseUrl}/league/${this.leagueId}/rosters`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching rosters:', error);
      return null;
    }
  }

  // Returns null (not []) on failure so callers can tell an outage apart from
  // a week that legitimately has no matchups yet (e.g. before the season's
  // schedule is generated) and fall back to cached data instead of publishing
  // an empty scoreboard.
  async getMatchups(week: number): Promise<SleeperMatchup[] | null> {
    try {
      const response = await fetch(`${this.baseUrl}/league/${this.leagueId}/matchups/${week}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching matchups:', error);
      return null;
    }
  }

  // Not league-scoped -- this is Sleeper's global NFL week/season clock, used
  // to know which week is "current" without waiting on the league endpoint.
  async getNflState(): Promise<SleeperNflState | null> {
    try {
      const response = await fetch(`${this.baseUrl}/state/nfl`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching NFL state:', error);
      return null;
    }
  }

  // Returns null (not []) when Sleeper is unreachable, so callers can tell an
  // outage apart from a league that genuinely has no teams and fall back to
  // cached data instead of publishing an empty league.
  async buildTeamData(processedPlayers: Record<string, SleeperPlayer & { cap_value: number; cap_value_formatted: string; search_name: string; has_zero_cap_warning: boolean; }>, salaryCap: number): Promise<Team[] | null> {
    const [users, rosters] = await Promise.all([this.getUsers(), this.getRosters()]);

    if (!users || !rosters) {
      console.error('Sleeper users/rosters unavailable; cannot build team data');
      return null;
    }

    const teams: Team[] = [];

    for (const roster of rosters) {
      const user = users.find(u => u.user_id === roster.owner_id);
      
      if (!user) continue;

      // Build roster from player IDs
      const rosterPlayers: Player[] = [];
      let totalSalaryCap = 0;

      if (roster.players) {
        for (const playerId of roster.players) {
          const player = processedPlayers[playerId];
          if (player) {
            const playerData: Player = {
              player_id: playerId,
              first_name: player.first_name,
              last_name: player.last_name,
              full_name: `${player.first_name} ${player.last_name}`,
              team: player.team,
              position: player.position,
              cap_value: player.cap_value,
              cap_value_formatted: player.cap_value_formatted,
              years_exp: player.years_exp,
              active: player.active,
              is_rostered: true,
              search_name: player.search_name,
              has_zero_cap_warning: player.has_zero_cap_warning
            };
            
            rosterPlayers.push(playerData);
            totalSalaryCap += player.cap_value || 0;
          }
        }
      }

      const team: Team = {
        team_id: roster.roster_id.toString(),
        owner_id: roster.owner_id,
        team_name: user.metadata?.team_name || user.display_name || 'Unnamed Team',
        owner_name: user.display_name,
        avatar_url: resolveAvatarUrl(user),
        wins: roster.settings?.wins || 0,
        losses: roster.settings?.losses || 0,
        ties: roster.settings?.ties || 0,
        total_points: roster.settings?.fpts || 0,
        roster: rosterPlayers,
        salary_cap: salaryCap,
        salary_used: totalSalaryCap,
        salary_remaining: salaryCap - totalSalaryCap,
        roster_size: rosterPlayers.length,
        max_roster_size: 25
      };

      teams.push(team);
    }

    return teams.sort((a, b) => b.total_points - a.total_points);
  }

  // Builds team rosters from picks made so far in an in-progress draft (keepers +
  // live picks), since the rosters endpoint still reflects last season until the
  // league leaves pre_draft.
  async buildTeamDataFromDraft(
    processedPlayers: Record<string, SleeperPlayer & { cap_value: number; cap_value_formatted: string; search_name: string; has_zero_cap_warning: boolean; }>,
    draftId: string,
    salaryCap: number
  ): Promise<Team[] | null> {
    const [users, rosters, picks] = await Promise.all([
      this.getUsers(),
      this.getRosters(),
      this.getDraftPicks(draftId),
    ]);

    if (!users || !rosters || !picks) {
      console.error('Sleeper users/rosters/picks unavailable; cannot build draft team data');
      return null;
    }

    const draftedPlayerIdsByRoster = new Map<number, string[]>();
    for (const pick of picks) {
      if (!pick.player_id) continue;
      const playerIds = draftedPlayerIdsByRoster.get(pick.roster_id) ?? [];
      playerIds.push(pick.player_id);
      draftedPlayerIdsByRoster.set(pick.roster_id, playerIds);
    }

    const teams: Team[] = [];

    for (const roster of rosters) {
      const user = users.find(u => u.user_id === roster.owner_id);

      if (!user) continue;

      const rosterPlayers: Player[] = [];
      let totalSalaryCap = 0;

      const draftedPlayerIds = draftedPlayerIdsByRoster.get(roster.roster_id) ?? [];
      for (const playerId of draftedPlayerIds) {
        const player = processedPlayers[playerId];
        if (player) {
          const playerData: Player = {
            player_id: playerId,
            first_name: player.first_name,
            last_name: player.last_name,
            full_name: `${player.first_name} ${player.last_name}`,
            team: player.team,
            position: player.position,
            cap_value: player.cap_value,
            cap_value_formatted: player.cap_value_formatted,
            years_exp: player.years_exp,
            active: player.active,
            is_rostered: true,
            search_name: player.search_name,
            has_zero_cap_warning: player.has_zero_cap_warning
          };

          rosterPlayers.push(playerData);
          totalSalaryCap += player.cap_value || 0;
        }
      }

      const team: Team = {
        team_id: roster.roster_id.toString(),
        owner_id: roster.owner_id,
        team_name: user.metadata?.team_name || user.display_name || 'Unnamed Team',
        owner_name: user.display_name,
        avatar_url: resolveAvatarUrl(user),
        wins: 0,
        losses: 0,
        ties: 0,
        total_points: 0,
        roster: rosterPlayers,
        salary_cap: salaryCap,
        salary_used: totalSalaryCap,
        salary_remaining: salaryCap - totalSalaryCap,
        roster_size: rosterPlayers.length,
        max_roster_size: 25
      };

      teams.push(team);
    }

    return teams.sort((a, b) => b.salary_used - a.salary_used);
  }
}
