import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth/firebase-auth';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import formidable from 'formidable';
import fs from 'fs';
import {
  buildExpertRankingMap,
  parseImportCsv,
  type CsvImportFormat,
  type StoredExpertRanking,
} from '@/lib/services/csv-import';

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
  format?: CsvImportFormat;
  data?: ProjectionData | Record<string, StoredExpertRanking>;
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

  console.log(`[UPLOAD] Upload request received`);

  const isAdmin = await requireAdmin(req);
  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden - admin access required'
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

    // Detect which supported format this is, then store it accordingly
    let parsed;
    try {
      parsed = parseImportCsv(csvContent);
    } catch (parseError) {
      const reason = parseError instanceof Error ? parseError.message : 'Unrecognized CSV';
      console.warn(`[UPLOAD] Could not parse CSV: ${reason}`);
      return res.status(400).json({
        success: false,
        message: `${reason}. Supported formats: projections (Player, Team, points) or expert rankings (Rank, Player Name, Team, Position, ECR).`
      });
    }

    console.log(`[UPLOAD] Detected format: ${parsed.format} with ${parsed.rows.length} rows`);

    if (parsed.format === 'expertRankings') {
      const rankings = buildExpertRankingMap(parsed.rows);

      // Merged, not replaced: these exports come one position group at a time,
      // so a new LB file must not wipe previously uploaded DB/DL rankings.
      await adminDb.collection('cache').doc('expertRankings').set(
        {
          rankings,
          uploadedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      const positionNote = parsed.positions.length > 0 ? ` (${parsed.positions.join(', ')})` : '';

      return res.status(200).json({
        success: true,
        format: parsed.format,
        message: `Successfully uploaded expert rankings for ${Object.keys(rankings).length} players${positionNote}`,
        data: rankings
      });
    }

    const projections: ProjectionData = {};
    parsed.rows.forEach(row => {
      projections[row.playerName] = {
        team: row.team,
        projection: row.projection,
      };
    });

    // Store projections in Firestore
    await adminDb.collection('cache').doc('projections').set({
      projections,
      uploadedAt: FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      success: true,
      format: parsed.format,
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
