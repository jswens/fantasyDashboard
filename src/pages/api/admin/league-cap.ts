// GET/POST /api/admin/league-cap
//
// Commissioner-only (see isCommissioner in firebase-auth.ts). Reads and sets
// the league-wide salary cap for a season, stored at
// leagueSettings/{season} — see src/lib/services/league-settings.ts for the
// audit-trail pattern (mirrors the per-player edit pattern in
// src/lib/services/player-edit.ts). POST clears the cached team data so cap/usage
// numbers on the dashboard reflect the new cap on the next load instead of waiting
// out the 60-minute team cache.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, isCommissioner } from '@/lib/auth/firebase-auth';
import { getCurrentCapSeason } from '@/lib/services/cap-numbers';
import { getLeagueSalaryCap, setLeagueSalaryCap } from '@/lib/services/league-settings';
import { TeamCacheService } from '@/lib/services/team-cache';
import type { LeagueCapRequest, LeagueCapResponse } from '@/lib/types/cap';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LeagueCapResponse>
) {
  const decoded = await requireAuth(req);
  if (!decoded) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  if (!(await isCommissioner(decoded.uid))) {
    return res.status(403).json({ success: false, message: 'Forbidden - commissioner access required' });
  }

  if (req.method === 'GET') {
    const season = (typeof req.query.season === 'string' && req.query.season.trim()) || getCurrentCapSeason();
    const { salaryCap, isDefault } = await getLeagueSalaryCap(season);
    return res.status(200).json({
      success: true,
      message: 'OK',
      data: { season, salaryCap, isDefault },
    });
  }

  if (req.method === 'POST') {
    try {
      const body = req.body as Partial<LeagueCapRequest>;
      const salaryCap = body.salaryCap;
      const season = body.season?.trim() || getCurrentCapSeason();

      if (typeof salaryCap !== 'number' || !Number.isFinite(salaryCap) || salaryCap <= 0) {
        return res.status(400).json({
          success: false,
          message: 'salaryCap (positive number) is required',
        });
      }

      await setLeagueSalaryCap(season, salaryCap, decoded.uid);
      await new TeamCacheService().clearCache();

      return res.status(200).json({
        success: true,
        message: `League salary cap for ${season} set to $${salaryCap.toLocaleString('en-US')}`,
        data: { season, salaryCap, isDefault: false },
      });
    } catch (error) {
      console.error('Error setting league salary cap:', error);
      return res.status(500).json({ success: false, message: 'Failed to set league salary cap' });
    }
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
}
