import type { NextApiRequest, NextApiResponse } from 'next';
import { FantasyDataService } from '@/lib/services/fantasy-data';

const fantasyDataService = new FantasyDataService();

export interface DataStatus {
  lastUpdated: string | null;
  stale: boolean;
  teamCount: number;
}

// Goes through getTeamsWithMeta() rather than reading the cache doc directly so
// it joins whatever refresh the page's other requests kicked off, and therefore
// reports the timestamp of the data those requests actually returned.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DataStatus | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store');

  try {
    const { teams, lastUpdated, stale } = await fantasyDataService.getTeamsWithMeta();
    res.status(200).json({
      lastUpdated: lastUpdated ? lastUpdated.toISOString() : null,
      stale,
      teamCount: teams.length,
    });
  } catch (error) {
    console.error('Error fetching data status:', error);
    res.status(500).json({ error: 'Failed to fetch data status' });
  }
}
