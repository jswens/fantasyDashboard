import type { NextApiRequest, NextApiResponse } from 'next';
import { validateSession } from '@/lib/auth/persistent-sessions';
import fs from 'fs';
import path from 'path';

interface TierData {
  [playerName: string]: {
    tier: number;
    position: number; // position within tier
  };
}

interface UploadResponse {
  success: boolean;
  message: string;
  data?: TierData;
}

function parseTierText(tierText: string): TierData {
  const tiers: TierData = {};
  
  console.log(`[TIER_UPLOAD] Parsing tier text: ${tierText.substring(0, 100)}...`);
  
  // Split by lines and process each line
  const lines = tierText.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    // Match pattern: "Tier X: Player1, Player2, Player3"
    const tierMatch = trimmedLine.match(/^Tier\s+(\d+):\s*(.+)$/i);
    
    if (tierMatch) {
      const tierNumber = parseInt(tierMatch[1]);
      const playersText = tierMatch[2];
      
      // Split players by comma and clean up names
      const players = playersText.split(',').map(p => p.trim()).filter(p => p);
      
      console.log(`[TIER_UPLOAD] Tier ${tierNumber}: ${players.length} players`);
      
      players.forEach((playerName, index) => {
        if (playerName) {
          tiers[playerName] = {
            tier: tierNumber,
            position: index + 1
          };
        }
      });
    }
  }
  
  console.log(`[TIER_UPLOAD] Parsed ${Object.keys(tiers).length} players into tiers`);
  return tiers;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  // Check authentication
  const sessionToken = req.headers.authorization?.replace('Bearer ', '');
  
  console.log(`[TIER_UPLOAD] Tier upload request received`);
  console.log(`[TIER_UPLOAD] Session token provided: ${sessionToken ? sessionToken.substring(0, 8) + '...' : 'NONE'}`);
  
  if (!sessionToken || !validateSession(sessionToken)) {
    console.log(`[TIER_UPLOAD] Authentication failed - Token: ${sessionToken ? 'provided but invalid' : 'missing'}`);
    return res.status(401).json({
      success: false,
      message: 'Unauthorized - Invalid or missing session token'
    });
  }
  
  console.log(`[TIER_UPLOAD] Authentication successful, processing tier data`);

  try {
    const { tierText } = req.body;
    
    if (!tierText || typeof tierText !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Tier text is required'
      });
    }
    
    // Parse tier data
    const tiers = parseTierText(tierText);
    
    if (Object.keys(tiers).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid tier data found in text'
      });
    }

    // Store tiers in a cache file
    const cacheDir = path.join(process.cwd(), 'data');
    const tiersCachePath = path.join(cacheDir, 'tiers-cache.json');
    
    // Ensure data directory exists
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    
    const cacheData = {
      uploadedAt: new Date().toISOString(),
      tiers
    };
    
    fs.writeFileSync(tiersCachePath, JSON.stringify(cacheData, null, 2));

    return res.status(200).json({
      success: true,
      message: `Successfully uploaded tiers for ${Object.keys(tiers).length} players`,
      data: tiers
    });

  } catch (error) {
    console.error('Error processing tier upload:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process tier data'
    });
  }
}