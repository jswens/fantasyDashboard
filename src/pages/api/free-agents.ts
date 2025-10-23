import type { NextApiRequest, NextApiResponse } from 'next';
import { FantasyDataService } from '@/lib/services/fantasy-data';
import { validateSession } from '@/lib/auth/persistent-sessions';
import fs from 'fs';
import path from 'path';

interface ProcessedPlayer {
  first_name: string;
  last_name: string;
  position: string;
  team: string | null;
  cap_value: number;
  cap_value_formatted: string;
}

interface FreeAgent {
  player_id: string;
  full_name: string;
  position: string;
  team: string | null;
  cap_value: number;
  cap_value_formatted: string;
  ranking: number;
  projection?: number;
  tier?: number;
  tierPosition?: number;
}

interface FreeAgentsByPosition {
  [position: string]: FreeAgent[];
}

interface FreeAgentsResponse {
  success: boolean;
  data?: FreeAgentsByPosition;
  message: string;
  totalFreeAgents?: number;
}

async function identifyFreeAgents(): Promise<FreeAgent[]> {
  const fantasyDataService = new FantasyDataService();
  
  // Get all teams first (this loads processed players internally)
  const teams = await fantasyDataService.getAllTeams();
  const rosteredPlayerIds = new Set<string>();
  
  teams.forEach(team => {
    team.roster.forEach(player => {
      rosteredPlayerIds.add(player.player_id);
    });
  });

  // Load projections if available
  let projections: Record<string, { team: string; projection: number }> = {};
  try {
    const projectionsCachePath = path.join(process.cwd(), 'data', 'projections-cache.json');
    if (fs.existsSync(projectionsCachePath)) {
      const projectionsData = JSON.parse(fs.readFileSync(projectionsCachePath, 'utf8'));
      projections = projectionsData.projections || {};
    }
  } catch (error) {
    console.warn('No projections data available:', error);
  }

  // Load tiers if available
  let tiers: Record<string, { tier: number; position: number }> = {};
  try {
    const tiersCachePath = path.join(process.cwd(), 'data', 'tiers-cache.json');
    if (fs.existsSync(tiersCachePath)) {
      const tiersData = JSON.parse(fs.readFileSync(tiersCachePath, 'utf8'));
      tiers = tiersData.tiers || {};
    }
  } catch (error) {
    console.warn('No tier data available:', error);
  }

  // Load processed players from cache file
  try {
    const cacheFilePath = path.join(process.cwd(), 'data', 'processed-players-cache.json');
    const fileData = fs.readFileSync(cacheFilePath, 'utf8');
    const cache = JSON.parse(fileData);
    const processedPlayers: Record<string, ProcessedPlayer> = cache.players;

    // Find free agents (players not on any roster)
    const freeAgents: FreeAgent[] = [];

    // Create array of free agents with projections and tiers
    const freeAgentEntries = Object.entries(processedPlayers)
      .filter(([playerId]) => !rosteredPlayerIds.has(playerId))
      .filter(([, player]) => player.position && player.cap_value > 0) // Only players with valid position and cap value
      .map(([playerId, player]) => {
        const playerName = `${player.first_name} ${player.last_name}`;
        const projection = projections[playerName]?.projection;
        const tierData = tiers[playerName];
        
        return {
          playerId,
          player,
          playerName,
          projection,
          tier: tierData?.tier,
          tierPosition: tierData?.position
        };
      });

    // Sort by tier first, then projection, then cap value
    const hasTiers = Object.keys(tiers).length > 0;
    const hasProjections = Object.keys(projections).length > 0;
    
    if (hasTiers) {
      // Sort by tier (ascending), then by position within tier (ascending)
      freeAgentEntries.sort((a, b) => {
        // Players with tiers come first
        if (a.tier !== undefined && b.tier === undefined) return -1;
        if (a.tier === undefined && b.tier !== undefined) return 1;
        
        // Both have tiers - sort by tier, then position within tier
        if (a.tier !== undefined && b.tier !== undefined) {
          if (a.tier !== b.tier) {
            return a.tier - b.tier; // Lower tier number = higher ranking
          }
          return (a.tierPosition || 0) - (b.tierPosition || 0); // Lower position = higher ranking
        }
        
        // Neither has tiers - use projection or cap value
        if (hasProjections) {
          if (a.projection !== undefined && b.projection !== undefined) {
            return b.projection - a.projection;
          }
          if (a.projection !== undefined && b.projection === undefined) {
            return -1;
          }
          if (a.projection === undefined && b.projection !== undefined) {
            return 1;
          }
        }
        
        // Fall back to cap value
        return b.player.cap_value - a.player.cap_value;
      });
    } else if (hasProjections) {
      // Sort by projection descending (players with projections first, then by cap value)
      freeAgentEntries.sort((a, b) => {
        if (a.projection !== undefined && b.projection !== undefined) {
          return b.projection - a.projection;
        }
        if (a.projection !== undefined && b.projection === undefined) {
          return -1; // a comes first
        }
        if (a.projection === undefined && b.projection !== undefined) {
          return 1; // b comes first
        }
        // Both undefined, sort by cap value
        return b.player.cap_value - a.player.cap_value;
      });
    } else {
      // Sort by cap value descending (default)
      freeAgentEntries.sort((a, b) => b.player.cap_value - a.player.cap_value);
    }

    // Build final free agents array with rankings
    freeAgentEntries.forEach(({ playerId, player, playerName, projection, tier, tierPosition }, index) => {
      freeAgents.push({
        player_id: playerId,
        full_name: playerName,
        position: player.position,
        team: player.team,
        cap_value: player.cap_value,
        cap_value_formatted: player.cap_value_formatted,
        ranking: index + 1,
        projection,
        tier,
        tierPosition
      });
    });

    return freeAgents;
  } catch (error) {
    console.error('Error reading processed players cache:', error);
    throw new Error('Failed to load player data');
  }
}

function groupByPosition(freeAgents: FreeAgent[]): FreeAgentsByPosition {
  const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'DL', 'LB', 'DB'];
  const grouped: FreeAgentsByPosition = {};

  positions.forEach(position => {
    grouped[position] = freeAgents
      .filter(player => player.position === position)
      .slice(0, 10); // Top 10 per position
  });

  return grouped;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FreeAgentsResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  // Check authentication
  const sessionToken = req.headers.authorization?.replace('Bearer ', '');
  
  console.log(`[FREE_AGENTS] Request received`);
  console.log(`[FREE_AGENTS] Session token provided: ${sessionToken ? sessionToken.substring(0, 8) + '...' : 'NONE'}`);
  
  if (!sessionToken || !validateSession(sessionToken)) {
    console.log(`[FREE_AGENTS] Authentication failed - Token: ${sessionToken ? 'provided but invalid' : 'missing'}`);
    return res.status(401).json({
      success: false,
      message: 'Unauthorized - Invalid or missing session token'
    });
  }
  
  console.log(`[FREE_AGENTS] Authentication successful, fetching free agents data`);

  try {
    // Get free agents
    const freeAgents = await identifyFreeAgents();
    
    // Group by position
    const freeAgentsByPosition = groupByPosition(freeAgents);

    return res.status(200).json({
      success: true,
      data: freeAgentsByPosition,
      totalFreeAgents: freeAgents.length,
      message: 'Free agents retrieved successfully'
    });

  } catch (error) {
    console.error('Error fetching free agents:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch free agents data'
    });
  }
}
