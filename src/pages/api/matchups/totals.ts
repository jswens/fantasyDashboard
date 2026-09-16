// GET /api/matchups/totals?through=N -- each team's summed points for weeks
// 1..N (1-18), for the season leaderboard on the matchups page.

import type { NextApiRequest, NextApiResponse } from 'next';
import { MatchupService } from '@/lib/services/matchups';
import type { SeasonTotals } from '@/lib/types/matchup';

const matchupService = new MatchupService();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SeasonTotals | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store');

  const throughParam = req.query.through;
  if (Array.isArray(throughParam)) {
    return res.status(400).json({ error: 'through must be a single value' });
  }

  const through = Number(throughParam);
  if (!Number.isInteger(through) || through < 1 || through > 18) {
    return res.status(400).json({ error: 'through must be an integer between 1 and 18' });
  }

  try {
    const totals = await matchupService.getSeasonTotals(through);
    res.status(200).json(totals);
  } catch (error) {
    console.error(`Error fetching season totals through week ${through}:`, error);
    res.status(500).json({ error: 'Failed to fetch season totals' });
  }
}
