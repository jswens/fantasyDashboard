import type { NextApiRequest, NextApiResponse } from 'next';
import { FantasyDataService } from '@/lib/services/fantasy-data';
import { requireAuth } from '@/lib/auth/firebase-auth';
import { adminDb } from '@/lib/firebase-admin';
import { normalizePlayerName } from '@/lib/services/cap-numbers';
import {
  normalizeStoredProjectionMap,
  type StoredExpertRanking,
  type StoredProjection,
} from '@/lib/services/csv-import';
import { normalizeStoredTierMap, type StoredTier } from '@/lib/services/tier-import';

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
  projection?: number;
  tier?: number;
  tierPosition?: number;
  // The rank straight out of the imported rankings file, which ranks rostered
  // and free-agent players alike — so it is already a league-wide rank, and no
  // rank is derived from this list's own ordering.
  expertRank?: number;
  expertEcr?: number;
  expertVsEcr?: number;
}

interface FreeAgentsByPosition {
  [position: string]: FreeAgent[];
}

interface FreeAgentsResponse {
  success: boolean;
  data?: FreeAgentsByPosition;
  message: string;
  totalFreeAgents?: number;
  /** Free agents at or below the requested cap ceiling; equal to totalFreeAgents when none was set. */
  affordableFreeAgents?: number;
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

  // Load projections if available. Uploads written since the re-keying are
  // already keyed by normalized name; normalizing here also covers documents
  // an admin uploaded before it, which are keyed by the raw CSV name.
  let projections: Record<string, StoredProjection> = {};
  try {
    const projDoc = await adminDb.collection('cache').doc('projections').get();
    if (projDoc.exists) {
      projections = normalizeStoredProjectionMap(projDoc.data()?.projections || {});
    }
  } catch (error) {
    console.warn('No projections data available:', error);
  }

  // Load tiers if available (same normalize-on-read treatment as projections)
  let tiers: Record<string, StoredTier> = {};
  try {
    const tiersDoc = await adminDb.collection('cache').doc('tiers').get();
    if (tiersDoc.exists) {
      tiers = normalizeStoredTierMap(tiersDoc.data()?.tiers || {});
    }
  } catch (error) {
    console.warn('No tier data available:', error);
  }

  // Load imported expert rankings if available (keyed by normalized name)
  let expertRankings: Record<string, StoredExpertRanking> = {};
  try {
    const rankingsDoc = await adminDb.collection('cache').doc('expertRankings').get();
    if (rankingsDoc.exists) {
      expertRankings = rankingsDoc.data()?.rankings || {};
    }
  } catch (error) {
    console.warn('No expert ranking data available:', error);
  }

  // Load processed players from Firestore
  try {
    const snapshot = await adminDb.collection('players').get();
    if (snapshot.empty) throw new Error('No processed players in Firestore');
    const processedPlayers: Record<string, ProcessedPlayer> = {};
    snapshot.forEach(doc => {
      processedPlayers[doc.id] = doc.data() as ProcessedPlayer;
    });

    // Find free agents (players not on any roster)
    const freeAgents: FreeAgent[] = [];

    // Create array of free agents with projections and tiers
    const freeAgentEntries = Object.entries(processedPlayers)
      .filter(([playerId]) => !rosteredPlayerIds.has(playerId))
      .filter(([, player]) => player.position && player.cap_value > 0) // Only players with valid position and cap value
      .map(([playerId, player]) => {
        const playerName = `${player.first_name} ${player.last_name}`;
        // All three uploaded sources are keyed by normalized name, so a
        // difference in spelling or suffix does not drop the match.
        const nameKey = normalizePlayerName(playerName);
        const projection = projections[nameKey]?.projection;
        const tierData = tiers[nameKey];
        const expert = expertRankings[nameKey];

        return {
          playerId,
          player,
          playerName,
          projection,
          tier: tierData?.tier,
          tierPosition: tierData?.position,
          expertRank: expert?.rank,
          expertEcr: expert?.ecr ?? undefined,
          expertVsEcr: expert?.vsEcr ?? undefined
        };
      });

    // Ranking priority: tiers, then projections, then imported expert
    // rankings, then cap value. Each source only breaks ties the one above it
    // left open, so uploading rankings never reorders a tiered or projected list.
    const hasTiers = Object.keys(tiers).length > 0;
    const hasProjections = Object.keys(projections).length > 0;
    const hasExpertRankings = Object.keys(expertRankings).length > 0;

    freeAgentEntries.sort((a, b) => {
      if (hasTiers) {
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
      }

      if (hasProjections) {
        // Players with projections come first, highest projection on top
        if (a.projection !== undefined && b.projection === undefined) return -1;
        if (a.projection === undefined && b.projection !== undefined) return 1;
        if (a.projection !== undefined && b.projection !== undefined) {
          if (a.projection !== b.projection) {
            return b.projection - a.projection;
          }
        }
      }

      if (hasExpertRankings) {
        // Ranked players come first, lowest rank number on top
        if (a.expertRank !== undefined && b.expertRank === undefined) return -1;
        if (a.expertRank === undefined && b.expertRank !== undefined) return 1;
        if (a.expertRank !== undefined && b.expertRank !== undefined) {
          if (a.expertRank !== b.expertRank) {
            return a.expertRank - b.expertRank;
          }
        }
      }

      // Fall back to cap value
      return b.player.cap_value - a.player.cap_value;
    });

    // Build the final list. The order comes from the sort above; the rank shown
    // to the user is expertRank, which the imported file supplies.
    freeAgentEntries.forEach(({ playerId, player, playerName, projection, tier, tierPosition, expertRank, expertEcr, expertVsEcr }) => {
      freeAgents.push({
        player_id: playerId,
        full_name: playerName,
        position: player.position,
        team: player.team,
        cap_value: player.cap_value,
        cap_value_formatted: player.cap_value_formatted,
        projection,
        tier,
        tierPosition,
        expertRank,
        expertEcr,
        expertVsEcr
      });
    });

    return freeAgents;
  } catch (error) {
    console.error('Error reading processed players cache:', error);
    throw new Error('Failed to load player data');
  }
}

/** Reads the optional ?maxCap= dollar ceiling; anything unusable means no filter. */
function parseMaxCap(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  return parsed;
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

  const decoded = await requireAuth(req);
  if (!decoded) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized'
    });
  }

  try {
    // Get free agents
    const freeAgents = await identifyFreeAgents();

    // An optional cap ceiling, applied before the per-position slice below so a
    // small budget still surfaces the best players it can actually afford
    // rather than filtering an already-truncated top 10 down to nothing.
    const maxCap = parseMaxCap(req.query.maxCap);
    const affordable = maxCap === null
      ? freeAgents
      : freeAgents.filter(player => player.cap_value <= maxCap);

    // Group by position
    const freeAgentsByPosition = groupByPosition(affordable);

    return res.status(200).json({
      success: true,
      data: freeAgentsByPosition,
      totalFreeAgents: freeAgents.length,
      affordableFreeAgents: affordable.length,
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
