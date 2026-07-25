import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/lib/auth/firebase-auth';
import { adminDb } from '@/lib/firebase-admin';
import { DraftService } from '@/lib/services/draft-service';
import { SleeperService } from '@/lib/services/sleeper-api';
import { DRAFT_LEAGUE_ID } from '@/lib/utils/constants';
import {
  DraftStatePick,
  DraftStatePlayerInfo,
  DraftStateResponse,
  DraftTeamSummary,
} from '@/lib/types/draft';

interface CachedPlayer {
  first_name: string;
  last_name: string;
  position: string;
  team: string | null;
}

// Positions that count as individual slots for roster-fill summaries.
// FLEX/SUPER_FLEX/BN/IR are handled separately below.
const NON_POSITION_SLOTS = new Set(['BN', 'IR', 'TAXI']);

async function loadPlayerInfo(playerIds: string[]): Promise<Record<string, DraftStatePlayerInfo>> {
  const result: Record<string, DraftStatePlayerInfo> = {};
  if (playerIds.length === 0) return result;

  // Firestore `in` queries are capped at 30 values per query.
  const CHUNK = 30;
  const uniqueIds = Array.from(new Set(playerIds));

  for (let i = 0; i < uniqueIds.length; i += CHUNK) {
    const chunk = uniqueIds.slice(i, i + CHUNK);
    try {
      const snapshot = await adminDb
        .collection('players')
        .where('__name__', 'in', chunk)
        .get();

      snapshot.forEach(doc => {
        const data = doc.data() as CachedPlayer;
        result[doc.id] = {
          player_id: doc.id,
          full_name: `${data.first_name} ${data.last_name}`,
          position: data.position,
          team: data.team ?? null,
        };
      });
    } catch (error) {
      console.error('Error loading player info chunk:', error);
    }
  }

  return result;
}

function buildTeamSummaries(
  picks: DraftStatePick[],
  slotToRosterId: Record<string, number> | null,
  draftOrder: Record<string, number> | null,
  rosterPositions: string[]
): DraftTeamSummary[] {
  const requiredCounts: Record<string, number> = {};
  for (const slot of rosterPositions) {
    if (NON_POSITION_SLOTS.has(slot)) continue;
    requiredCounts[slot] = (requiredCounts[slot] || 0) + 1;
  }

  // slot number -> roster_id
  const slotToRoster = slotToRosterId || {};
  // user_id -> slot number
  const order = draftOrder || {};
  const slotToOwner: Record<number, string> = {};
  for (const [userId, slot] of Object.entries(order)) {
    slotToOwner[slot] = userId;
  }

  // roster_id -> team summary
  const teamsByRoster = new Map<number, DraftTeamSummary>();

  const getOrCreateTeam = (rosterId: number | null, draftSlot: number | null): DraftTeamSummary => {
    const key = rosterId ?? -1 * (draftSlot ?? 0) - 1000; // fallback key when roster_id missing
    if (!teamsByRoster.has(key)) {
      const ownerId = draftSlot !== null ? slotToOwner[draftSlot] ?? null : null;
      teamsByRoster.set(key, {
        roster_id: rosterId,
        draft_slot: draftSlot,
        owner_id: ownerId,
        picks_made: 0,
        picks_by_position: {},
        roster_slots: Object.entries(requiredCounts).map(([position, required]) => ({
          position,
          required,
          filled: 0,
        })),
      });
    }
    return teamsByRoster.get(key)!;
  };

  // Ensure every known draft slot has a team entry, even with zero picks.
  for (const [slotStr, rosterId] of Object.entries(slotToRoster)) {
    const slot = parseInt(slotStr, 10);
    getOrCreateTeam(rosterId, slot);
  }

  for (const pick of picks) {
    const team = getOrCreateTeam(pick.roster_id, pick.draft_slot ?? null);
    team.picks_made += 1;

    const position = pick.player?.position;
    if (position) {
      team.picks_by_position[position] = (team.picks_by_position[position] || 0) + 1;

      const slotEntry = team.roster_slots.find(s => s.position === position);
      if (slotEntry && slotEntry.filled < slotEntry.required) {
        slotEntry.filled += 1;
      }
    }
  }

  return Array.from(teamsByRoster.values()).sort((a, b) => (a.draft_slot ?? 0) - (b.draft_slot ?? 0));
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DraftStateResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const decoded = await requireAuth(req);
  if (!decoded) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const draftService = new DraftService(DRAFT_LEAGUE_ID);

    const currentDraft = await draftService.getCurrentDraft();
    if (!currentDraft) {
      return res.status(404).json({ success: false, message: 'No draft found for this league' });
    }

    const [draft, picks, league] = await Promise.all([
      draftService.getDraft(currentDraft.draft_id),
      draftService.getPicks(currentDraft.draft_id),
      new SleeperService(DRAFT_LEAGUE_ID).getLeague(),
    ]);

    if (!draft) {
      return res.status(502).json({ success: false, message: 'Failed to load draft settings from Sleeper' });
    }

    const rawPicks = picks || [];
    const playerInfoMap = await loadPlayerInfo(rawPicks.map(p => p.player_id).filter(Boolean));

    const enrichedPicks: DraftStatePick[] = rawPicks
      .sort((a, b) => a.pick_no - b.pick_no)
      .map(pick => {
        let player = playerInfoMap[pick.player_id] || null;

        // Fall back to Sleeper-provided pick metadata if our players cache doesn't have this id.
        if (!player && pick.metadata?.first_name) {
          player = {
            player_id: pick.player_id,
            full_name: `${pick.metadata.first_name} ${pick.metadata.last_name || ''}`.trim(),
            position: pick.metadata.position || '',
            team: pick.metadata.team || null,
          };
        }

        return {
          pick_no: pick.pick_no,
          round: pick.round,
          draft_slot: pick.draft_slot,
          roster_id: pick.roster_id,
          picked_by: pick.picked_by,
          player,
        };
      });

    const rosterPositions = league?.roster_positions || draft.roster_positions || [];

    const teams = buildTeamSummaries(
      enrichedPicks,
      draft.slot_to_roster_id,
      draft.draft_order,
      rosterPositions
    );

    return res.status(200).json({
      success: true,
      message: 'Draft state retrieved successfully',
      data: {
        draft: {
          draft_id: draft.draft_id,
          league_id: draft.league_id,
          status: draft.status,
          season: draft.season,
          rounds: draft.settings?.rounds ?? null,
          roster_positions: rosterPositions,
          slot_to_roster_id: draft.slot_to_roster_id,
          draft_order: draft.draft_order,
        },
        picks: enrichedPicks,
        totalPicks: enrichedPicks.length,
        teams,
      },
    });
  } catch (error) {
    console.error('Error building draft state:', error);
    return res.status(500).json({ success: false, message: 'Failed to load draft state' });
  }
}
