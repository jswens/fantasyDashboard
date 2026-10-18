import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth/firebase-auth';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { buildTierMap, parseTierText, type StoredTier } from '@/lib/services/tier-import';

interface UploadResponse {
  success: boolean;
  message: string;
  data?: Record<string, StoredTier>;
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

  console.log(`[TIER_UPLOAD] Tier upload request received`);

  const isAdmin = await requireAdmin(req);
  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden - admin access required'
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

    console.log(`[TIER_UPLOAD] Parsing tier text: ${tierText.substring(0, 100)}...`);

    // Keyed by normalized name so the pasted spelling does not have to match
    // Sleeper's; each entry keeps the pasted name for display and debugging.
    const tiers = buildTierMap(parseTierText(tierText));

    console.log(`[TIER_UPLOAD] Parsed ${Object.keys(tiers).length} players into tiers`);

    if (Object.keys(tiers).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid tier data found in text'
      });
    }

    // Store tiers in Firestore
    await adminDb.collection('cache').doc('tiers').set({
      tiers,
      uploadedAt: FieldValue.serverTimestamp(),
    });

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
