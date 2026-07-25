// POST /api/admin/cap-override
//
// Admin-only. Sets a single player's effective cap number for a season, stored
// as an override layer at capNumbers/{season}/overrides/{playerId} so that a
// future re-import (POST /api/admin/import-cap-numbers) never silently wipes
// manual fixes — see src/lib/services/cap-numbers.ts for how overrides are
// layered on top of imported/legacy values.
//
// League rule: cap numbers lock at the start of the season; this endpoint is
// the only in-season mutation path, reserved for the few special cases the
// league allows. Every write appends to an audit trail (who, when, previous
// value) on the override document itself.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, isAdmin } from '@/lib/auth/firebase-auth';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getCurrentCapSeason } from '@/lib/services/cap-numbers';
import type { CapOverrideDocument, CapOverrideRequest, CapOverrideResponse } from '@/lib/types/cap';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CapOverrideResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const decoded = await requireAuth(req);
  if (!decoded) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  if (!(await isAdmin(decoded.uid))) {
    return res.status(403).json({ success: false, message: 'Forbidden - admin access required' });
  }

  try {
    const body = req.body as Partial<CapOverrideRequest>;
    const playerId = body.playerId?.trim();
    const capHit = body.capHit;
    const reason = body.reason?.trim();
    const season = body.season?.trim() || getCurrentCapSeason();

    if (!playerId || typeof capHit !== 'number' || !Number.isFinite(capHit) || capHit < 0) {
      return res.status(400).json({
        success: false,
        message: 'playerId (string) and capHit (non-negative number) are required',
      });
    }

    const overrideRef = adminDb
      .collection('capNumbers')
      .doc(season)
      .collection('overrides')
      .doc(playerId);

    const existingSnap = await overrideRef.get();
    const existing = existingSnap.exists ? (existingSnap.data() as CapOverrideDocument) : null;
    const previousValue = existing?.capHit ?? null;

    const auditEntry = {
      uid: decoded.uid,
      changedAt: FieldValue.serverTimestamp(),
      previousValue,
      newValue: capHit,
    };

    const newDoc: Omit<CapOverrideDocument, 'history'> & { history: unknown[] } = {
      playerId,
      capHit,
      reason,
      updatedBy: decoded.uid,
      updatedAt: FieldValue.serverTimestamp(),
      previousValue,
      history: [...(existing?.history || []), auditEntry],
    };

    await overrideRef.set(newDoc);

    return res.status(200).json({
      success: true,
      message: `Cap override set for player ${playerId}: $${capHit.toLocaleString('en-US')}`,
      data: newDoc as unknown as CapOverrideDocument,
    });
  } catch (error) {
    console.error('Error setting cap override:', error);
    return res.status(500).json({ success: false, message: 'Failed to set cap override' });
  }
}
