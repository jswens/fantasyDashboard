import type { NextApiRequest, NextApiResponse } from 'next';
import { validateSession } from '@/lib/auth/persistent-sessions';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

interface ProjectionData {
  [playerName: string]: {
    team: string;
    projection: number;
  };
}

interface UploadResponse {
  success: boolean;
  message: string;
  data?: ProjectionData;
}

function parseCSV(csvContent: string): ProjectionData {
  const lines = csvContent.split('\n').filter(line => line.trim());
  const projections: ProjectionData = {};
  
  if (lines.length === 0) return projections;
  
  // Parse header to determine format
  const headerLine = lines[0].trim();
  const headers = headerLine.split(',').map(h => h.trim().toLowerCase());
  
  console.log(`[UPLOAD] CSV headers detected: ${headers.join(', ')}`);
  
  // Determine column indices based on header format
  let playerNameIndex = -1;
  let teamIndex = -1;
  let projectionIndex = -1;
  
  // Look for player name column
  const playerNameOptions = ['player', 'name', 'full_name', 'player_name'];
  for (let i = 0; i < headers.length; i++) {
    if (playerNameOptions.some(option => headers[i].includes(option))) {
      playerNameIndex = i;
      break;
    }
  }
  
  // Look for team column
  const teamOptions = ['team', 'pos'];
  for (let i = 0; i < headers.length; i++) {
    if (teamOptions.some(option => headers[i] === option)) {
      teamIndex = i;
      break;
    }
  }
  
  // Look for projection column
  const projectionOptions = ['projection', 'projections', 'points', 'pts', 'big3 ffpts', 'ffpts'];
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].toLowerCase();
    if (projectionOptions.some(option => header.includes(option))) {
      projectionIndex = i;
      break;
    }
  }
  
  console.log(`[UPLOAD] Column indices - Player: ${playerNameIndex}, Team: ${teamIndex}, Projection: ${projectionIndex}`);
  
  // Fallback to original format if header detection fails
  if (playerNameIndex === -1) playerNameIndex = 0;
  if (teamIndex === -1) teamIndex = 1;
  if (projectionIndex === -1) projectionIndex = 2;
  
  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const columns = line.split(',');
    
    if (columns.length > Math.max(playerNameIndex, teamIndex, projectionIndex)) {
      const playerName = columns[playerNameIndex]?.trim();
      const team = columns[teamIndex]?.trim() || '';
      const projectionStr = columns[projectionIndex]?.trim();
      const projection = parseFloat(projectionStr);
      
      if (playerName && !isNaN(projection) && projection > 0) {
        projections[playerName] = {
          team,
          projection
        };
      }
    }
  }
  
  console.log(`[UPLOAD] Parsed ${Object.keys(projections).length} valid projections`);
  return projections;
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
  
  console.log(`[UPLOAD] Upload request received`);
  console.log(`[UPLOAD] Session token provided: ${sessionToken ? sessionToken.substring(0, 8) + '...' : 'NONE'}`);
  
  if (!sessionToken || !validateSession(sessionToken)) {
    console.log(`[UPLOAD] Authentication failed - Token: ${sessionToken ? 'provided but invalid' : 'missing'}`);
    return res.status(401).json({
      success: false,
      message: 'Unauthorized - Invalid or missing session token'
    });
  }
  
  console.log(`[UPLOAD] Authentication successful, processing file upload`);

  try {
    const form = formidable({
      maxFileSize: 5 * 1024 * 1024, // 5MB limit
    });

    const [, files] = await form.parse(req);
    
    const file = Array.isArray(files.projections) ? files.projections[0] : files.projections;
    
    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Read the uploaded file
    const csvContent = fs.readFileSync(file.filepath, 'utf8');
    
    // Parse CSV data
    const projections = parseCSV(csvContent);
    
    if (Object.keys(projections).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid projection data found in file'
      });
    }

    // Store projections in a cache file
    const cacheDir = path.join(process.cwd(), 'data');
    const projectionsCachePath = path.join(cacheDir, 'projections-cache.json');
    
    // Ensure data directory exists
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    
    const cacheData = {
      uploadedAt: new Date().toISOString(),
      projections
    };
    
    fs.writeFileSync(projectionsCachePath, JSON.stringify(cacheData, null, 2));

    return res.status(200).json({
      success: true,
      message: `Successfully uploaded projections for ${Object.keys(projections).length} players`,
      data: projections
    });

  } catch (error) {
    console.error('Error processing projection upload:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process projection file'
    });
  }
}
