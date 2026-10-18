#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = 'https://api.sleeper.app/v1';
const outputDir = path.resolve(process.env.SLEEPER_DATA_DIR ?? 'data/sleeper/current');
const fetchedAt = new Date().toISOString();

async function loadLeagueId() {
  if (process.env.NEXT_PUBLIC_SLEEPER_LEAGUE_ID) {
    return process.env.NEXT_PUBLIC_SLEEPER_LEAGUE_ID;
  }

  try {
    const envFile = await fs.readFile(path.resolve('.env.local'), 'utf8');
    const match = envFile.match(/^NEXT_PUBLIC_SLEEPER_LEAGUE_ID\s*=\s*(.+)$/m);
    return match?.[1]?.trim() || null;
  } catch {
    return null;
  }
}

const leagueId = await loadLeagueId();

if (!leagueId) {
  console.error('NEXT_PUBLIC_SLEEPER_LEAGUE_ID is required.');
  process.exit(1);
}

async function fetchJson(endpoint) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    throw new Error(`${endpoint} returned HTTP ${response.status}`);
  }

  return response.json();
}

async function writeJson(fileName, value) {
  await fs.writeFile(
    path.join(outputDir, fileName),
    `${JSON.stringify(value, null, 2)}\n`,
    'utf8',
  );
}

function getPlayerName(player) {
  return player.full_name
    ?? ([player.first_name, player.last_name].filter(Boolean).join(' ') || player.player_id);
}

try {
  console.log(`Pulling Sleeper league ${leagueId}...`);

  const [league, users, rosters, players, nflState] = await Promise.all([
    fetchJson(`/league/${leagueId}`),
    fetchJson(`/league/${leagueId}/users`),
    fetchJson(`/league/${leagueId}/rosters`),
    fetchJson('/players/nfl'),
    fetchJson('/state/nfl'),
  ]);

  const rosteredPlayerIds = new Set(
    rosters.flatMap((roster) => Array.isArray(roster.players) ? roster.players : []),
  );

  const freeAgents = Object.values(players)
    .filter((player) => player && !rosteredPlayerIds.has(player.player_id))
    .filter((player) => player.active !== false && player.position)
    .sort((a, b) => getPlayerName(a).localeCompare(getPlayerName(b)));

  const usersById = new Map(users.map((user) => [user.user_id, user]));
  const rostersWithOwners = rosters.map((roster) => {
    const owner = usersById.get(roster.owner_id) ?? null;
    const ownerName = owner?.display_name ?? null;
    const teamName = owner?.metadata?.team_name ?? ownerName;
    const playerIds = Array.isArray(roster.players) ? roster.players : [];

    return {
      ...roster,
      owner,
      owner_name: ownerName,
      team_name: teamName,
      players_detail: playerIds
        .map((playerId) => players[playerId] ?? null)
        .filter(Boolean),
    };
  });

  await fs.mkdir(outputDir, { recursive: true });

  await Promise.all([
    writeJson('league.json', {
      fetched_at: fetchedAt,
      league,
      nfl_state: nflState,
    }),
    writeJson('users.json', {
      fetched_at: fetchedAt,
      league_id: leagueId,
      count: users.length,
      users,
    }),
    writeJson('players.json', {
      fetched_at: fetchedAt,
      league_id: leagueId,
      season: league.season ?? nflState.season ?? null,
      count: Object.keys(players).length,
      players,
    }),
    writeJson('rosters.json', {
      fetched_at: fetchedAt,
      league_id: leagueId,
      season: league.season ?? nflState.season ?? null,
      count: rostersWithOwners.length,
      rosters: rostersWithOwners,
    }),
    writeJson('free-agents.json', {
      fetched_at: fetchedAt,
      league_id: leagueId,
      season: league.season ?? nflState.season ?? null,
      count: freeAgents.length,
      criteria: 'Active Sleeper players with a position who are not present on any current league roster.',
      players: freeAgents,
    }),
    writeJson('manifest.json', {
      source: 'Sleeper API',
      fetched_at: fetchedAt,
      league_id: leagueId,
      season: league.season ?? nflState.season ?? null,
      nfl_week: nflState.week ?? null,
      files: {
        league: 'league.json',
        users: 'users.json',
        players: 'players.json',
        rosters: 'rosters.json',
        free_agents: 'free-agents.json',
      },
      counts: {
        users: users.length,
        players: Object.keys(players).length,
        rosters: rostersWithOwners.length,
        rostered_players: rosteredPlayerIds.size,
        free_agents: freeAgents.length,
      },
    }),
  ]);

  console.log(`Saved ${Object.keys(players).length} players, ${rostersWithOwners.length} rosters, and ${freeAgents.length} free agents to ${outputDir}`);
} catch (error) {
  console.error(`Sleeper data pull failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
