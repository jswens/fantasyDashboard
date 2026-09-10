// GET /api/matchups/[week] -- WeekScoreboard for a specific NFL week (1-18).

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

  // Next hands query params back as string | string[] -- an array means the
  // route was hit as /api/matchups/[week]?week=2, which isn't a valid week.
  const weekParam = req.query.week;
  if (Array.isArray(weekParam)) {
    return res.status(400).json({ error: 'week must be a single value' });
  }

  const week = Number(weekParam);
  if (!Number.isInteger(week) || week < 1 || week > 18) {
    return res.status(400).json({ error: 'week must be an integer between 1 and 18' });
  }

  try {
    const scoreboard = await matchupService.getScoreboard(week);
    res.status(200).json(scoreboard);
  } catch (error) {
    console.error(`Error fetching scoreboard for week ${week}:`, error);
    res.status(500).json({ error: 'Failed to fetch scoreboard' });
  }
}
