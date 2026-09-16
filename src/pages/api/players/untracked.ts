// GET/POST /api/players/untracked
//
// GET: any signed-in user. Every player on a league roster that has no
// players/{playerId} doc, and so isn't counted in any roster or cap total
// (see src/lib/services/untracked-players.ts).
//
// POST: commissioner or admin only. Body { playerId, cap_value? } creates the
// player doc from Sleeper's current data -- any Sleeper player ID is accepted,
// not just ones currently flagged. Clears the team cache so the player shows
// up on their roster immediately.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, isAdmin, isCommissioner } from '@/lib/auth/firebase-auth';
import { FantasyDataService } from '@/lib/services/fantasy-data';
import { TeamCacheService } from '@/lib/services/team-cache';
import { addPlayerFromSleeper } from '@/lib/services/untracked-players';
import type { UntrackedRosterPlayer } from '@/lib/types';

export interface UntrackedPlayerRow extends UntrackedRosterPlayer {
  fantasy_team_id: string;
  fantasy_team_name: string;
}

export interface UntrackedPlayersResponse {
  success: boolean;
  message: string;
  data?: UntrackedPlayerRow[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UntrackedPlayersResponse>
) {
  const decoded = await requireAuth(req);
  if (!decoded) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    try {
      const teams = await new FantasyDataService().getAllTeams();
      const data = teams.flatMap(team =>
        (team.untracked_players ?? []).map(p => ({
          ...p,
          fantasy_team_id: team.team_id,
          fantasy_team_name: team.team_name,
        }))
      );
      return res.status(200).json({ success: true, message: 'OK', data });
    } catch (error) {
      console.error('Error listing untracked players:', error);
      return res.status(500).json({ success: false, message: 'Failed to list untracked players' });
    }
  }

  if (req.method === 'POST') {
    const [adminStatus, commissionerStatus] = await Promise.all([
      isAdmin(decoded.uid),
      isCommissioner(decoded.uid),
    ]);
    if (!adminStatus && !commissionerStatus) {
      return res.status(403).json({ success: false, message: 'Forbidden - admin or commissioner access required' });
    }

    const body = (req.body ?? {}) as { playerId?: unknown; cap_value?: unknown };
    const playerId = typeof body.playerId === 'string' ? body.playerId.trim() : '';
    if (!/^[A-Za-z0-9]+$/.test(playerId)) {
      return res.status(400).json({ success: false, message: 'playerId must be a Sleeper player ID' });
    }

    let capValue: number | null = null;
    if (body.cap_value !== undefined && body.cap_value !== null) {
      if (typeof body.cap_value !== 'number' || !Number.isFinite(body.cap_value) || body.cap_value < 0) {
        return res.status(400).json({ success: false, message: 'cap_value must be a non-negative number' });
      }
      capValue = Math.round(body.cap_value);
    }

    try {
      const result = await addPlayerFromSleeper(
        playerId,
        capValue,
        { uid: decoded.uid, email: decoded.email || '' }
      );

      switch (result.status) {
        case 'exists':
          return res.status(409).json({ success: false, message: `Player ${playerId} is already tracked` });
        case 'not_found':
          return res.status(404).json({ success: false, message: `Sleeper has no player with ID ${playerId}` });
        case 'sleeper_unavailable':
          return res.status(502).json({ success: false, message: "Couldn't reach Sleeper to look up the player. Try again shortly." });
      }

      await new TeamCacheService().clearCache();
      return res.status(201).json({ success: true, message: `Added ${result.fullName}` });
    } catch (error) {
      console.error('Error adding player:', error);
      return res.status(500).json({ success: false, message: 'Failed to add player' });
    }
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
}
