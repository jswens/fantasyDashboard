// GET/PATCH /api/players/[playerId]
//
// GET: any signed-in user. Returns the player's full record — including
// edited_fields and audit_history — plus rostered status.
//
// PATCH: commissioner or admin only. Body is a partial PlayerEditRequest
// (first_name, last_name, team, cap_value — only include fields being
// changed). `team` must be one of the 32 NFL team abbreviations in
// src/lib/constants/nflTeams.ts, or null/omitted for a free agent. Writes
// directly to players/{playerId} via src/lib/services/player-edit.ts, which
// appends an audit_history entry per changed field. Clears the team cache
// afterward (same pattern as /api/admin/league-cap) so roster/cap totals
// reflect the edit immediately.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, isAdmin, isCommissioner } from '@/lib/auth/firebase-auth';
import { adminDb } from '@/lib/firebase-admin';
import { FantasyDataService } from '@/lib/services/fantasy-data';
import { TeamCacheService } from '@/lib/services/team-cache';
import { editPlayerFields, toPlayerDetail } from '@/lib/services/player-edit';
import { isValidNFLTeam } from '@/lib/constants/nflTeams';
import type { PlayerDetailResponse, PlayerEditRequest, PlayerEditResponse } from '@/lib/types/playerEdit';

async function getRosterStatus(playerId: string): Promise<{ isRostered: boolean; rosterTeamName?: string }> {
  const teams = await new FantasyDataService().getAllTeams().catch(() => []);
  for (const team of teams) {
    if (team.roster.some(p => p.player_id === playerId)) {
      return { isRostered: true, rosterTeamName: team.team_name };
    }
  }
  return { isRostered: false };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PlayerDetailResponse | PlayerEditResponse>
) {
  const decoded = await requireAuth(req);
  if (!decoded) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const playerIdRaw = req.query.playerId;
  const playerId = Array.isArray(playerIdRaw) ? playerIdRaw[0] : playerIdRaw;
  if (!playerId) {
    return res.status(400).json({ success: false, message: 'playerId is required' });
  }

  if (req.method === 'GET') {
    try {
      const [snap, rosterStatus] = await Promise.all([
        adminDb.collection('players').doc(playerId).get(),
        getRosterStatus(playerId),
      ]);
      if (!snap.exists) {
        return res.status(404).json({ success: false, message: 'Player not found' });
      }
      const data = toPlayerDetail(
        snap.data() as Parameters<typeof toPlayerDetail>[0],
        rosterStatus.isRostered,
        rosterStatus.rosterTeamName
      );
      return res.status(200).json({ success: true, message: 'OK', data });
    } catch (error) {
      console.error('Error fetching player:', error);
      return res.status(500).json({ success: false, message: 'Failed to fetch player' });
    }
  }

  if (req.method === 'PATCH') {
    const [adminStatus, commissionerStatus] = await Promise.all([
      isAdmin(decoded.uid),
      isCommissioner(decoded.uid),
    ]);
    if (!adminStatus && !commissionerStatus) {
      return res.status(403).json({ success: false, message: 'Forbidden - admin or commissioner access required' });
    }

    try {
      const body = req.body as Partial<PlayerEditRequest>;
      const edits: PlayerEditRequest = {};

      if (body.first_name !== undefined) {
        const trimmed = body.first_name.trim();
        if (!trimmed) {
          return res.status(400).json({ success: false, message: 'first_name cannot be empty' });
        }
        edits.first_name = trimmed;
      }
      if (body.last_name !== undefined) {
        const trimmed = body.last_name.trim();
        if (!trimmed) {
          return res.status(400).json({ success: false, message: 'last_name cannot be empty' });
        }
        edits.last_name = trimmed;
      }
      if (body.team !== undefined) {
        const trimmed = body.team === null ? '' : body.team.trim().toUpperCase();
        if (trimmed === '' || trimmed === 'FA') {
          edits.team = null;
        } else if (isValidNFLTeam(trimmed)) {
          edits.team = trimmed;
        } else {
          return res.status(400).json({ success: false, message: `team must be "FA" or one of the 32 NFL team abbreviations (got "${body.team}")` });
        }
      }
      if (body.cap_value !== undefined) {
        if (typeof body.cap_value !== 'number' || !Number.isFinite(body.cap_value) || body.cap_value < 0) {
          return res.status(400).json({ success: false, message: 'cap_value must be a non-negative number' });
        }
        edits.cap_value = body.cap_value;
      }

      if (Object.keys(edits).length === 0) {
        return res.status(400).json({ success: false, message: 'No editable fields provided' });
      }

      const updated = await editPlayerFields(
        playerId,
        edits,
        { uid: decoded.uid, email: decoded.email || '' },
        'manual-edit'
      );
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Player not found' });
      }

      await new TeamCacheService().clearCache();

      const rosterStatus = await getRosterStatus(playerId);
      const data = toPlayerDetail(updated, rosterStatus.isRostered, rosterStatus.rosterTeamName);

      return res.status(200).json({ success: true, message: 'Player updated', data });
    } catch (error) {
      console.error('Error updating player:', error);
      return res.status(500).json({ success: false, message: 'Failed to update player' });
    }
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
}
