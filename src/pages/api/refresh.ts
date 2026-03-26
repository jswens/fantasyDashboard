import { NextApiRequest, NextApiResponse } from 'next';
import { FantasyDataService } from '@/lib/services/fantasy-data';
import { requireAdmin } from '@/lib/auth/firebase-auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const isAdmin = await requireAdmin(req);
  if (!isAdmin) {
    return res.status(403).json({ error: 'Forbidden - admin access required' });
  }

  try {
    const fantasyDataService = new FantasyDataService();
    
    const { force } = req.body;
    
    let success: boolean;
    
    if (force) {
      console.log('Force refreshing all data...');
      success = await fantasyDataService.forceRefreshAllData();
    } else {
      console.log('Refreshing player data only...');
      success = await fantasyDataService.refreshPlayerData();
    }

    if (success) {
      res.status(200).json({ 
        message: force ? 'All data refreshed successfully' : 'Player data refreshed successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to refresh data'
      });
    }
  } catch (error) {
    console.error('Error in refresh endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
