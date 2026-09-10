// GET /api/matchups/current -- WeekScoreboard for the league's current week
// (per Sleeper's /state/nfl), cached the same way as /api/matchups/[week].

import type { NextApiRequest, NextApiResponse } from 'next';
import { MatchupService } from '@/lib/services/matchups';
import type { WeekScoreboard } from '@/lib/types/matchup';

const matchupService = new MatchupService();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WeekScoreboard | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store');

  try {
    const scoreboard = await matchupService.getCurrentWeekScoreboard();
    res.status(200).json(scoreboard);
  } catch (error) {
    console.error('Error fetching current week scoreboard:', error);
    res.status(500).json({ error: 'Failed to fetch current week scoreboard' });
  }
}
