import type { NextApiRequest, NextApiResponse } from 'next';
import { FantasyDataService } from '@/lib/services/fantasy-data';

const fantasyDataService = new FantasyDataService();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const stats = await fantasyDataService.getLeagueStats();
    res.status(200).json(stats);
  } catch (error) {
    console.error('Error fetching league stats:', error);
    res.status(500).json({ error: 'Failed to fetch league stats' });
  }
}
