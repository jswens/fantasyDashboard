import type { NextApiRequest, NextApiResponse } from 'next';
import { FantasyDataService } from '@/lib/services/fantasy-data';

const fantasyDataService = new FantasyDataService();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method === 'GET') {
      // Get cache information
      const cacheInfo = await fantasyDataService.getCacheInfo();
      res.status(200).json(cacheInfo);
    } else if (req.method === 'POST') {
      const { action } = req.body;
      
      switch (action) {
        case 'refresh':
          // Force refresh the cache
          const refreshSuccess = await fantasyDataService.refreshTeamCache();
          res.status(200).json({ 
            success: refreshSuccess,
            message: refreshSuccess ? 'Cache refreshed successfully' : 'Failed to refresh cache'
          });
          break;
          
        case 'clear':
          // Clear the cache
          const clearSuccess = await fantasyDataService.clearTeamCache();
          res.status(200).json({ 
            success: clearSuccess,
            message: clearSuccess ? 'Cache cleared successfully' : 'Failed to clear cache'
          });
          break;
          
        default:
          res.status(400).json({ error: 'Invalid action. Use "refresh" or "clear"' });
      }
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in cache API:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
