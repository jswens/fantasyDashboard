import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/lib/auth/firebase-auth';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  GetMarksResponse,
  PlayerMark,
  PlayerMarkType,
  SetMarkResponse,
} from '@/lib/types/marks';

const VALID_MARKS: PlayerMarkType[] = ['sleeper', 'target', 'avoid'];

function currentSeason(): string {
  // Sleeper NFL seasons run roughly Mar-Feb; treat Jan/Feb as still part of the prior season.
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-indexed
  return String(month <= 1 ? year - 1 : year);
}

async function handleGet(req: NextApiRequest, res: NextApiResponse<GetMarksResponse>, uid: string) {
  const season = typeof req.query.season === 'string' ? req.query.season : currentSeason();

  try {
    const snapshot = await adminDb
      .collection('users')
      .doc(uid)
      .collection('playerMarks')
      .where('season', '==', season)
      .get();

    const marks: Record<string, PlayerMark> = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      const updatedAt = data.updatedAt?.toDate?.() as Date | undefined;
      marks[doc.id] = {
        playerId: doc.id,
        mark: data.mark,
        note: data.note ?? undefined,
        season: data.season,
        updatedAt: (updatedAt ?? new Date()).toISOString(),
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Marks retrieved successfully',
      marks,
      season,
    });
  } catch (error) {
    console.error('Error loading player marks:', error);
    return res.status(500).json({ success: false, message: 'Failed to load player marks' });
  }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse<SetMarkResponse>, uid: string) {
  const { playerId, mark, note, season } = req.body || {};

  if (!playerId || typeof playerId !== 'string') {
    return res.status(400).json({ success: false, message: 'playerId is required' });
  }

  if (mark !== null && mark !== undefined && !VALID_MARKS.includes(mark)) {
    return res.status(400).json({ success: false, message: 'Invalid mark type' });
  }

  const resolvedSeason = typeof season === 'string' && season ? season : currentSeason();
  const docRef = adminDb.collection('users').doc(uid).collection('playerMarks').doc(playerId);

  try {
    // Clearing the mark: mark is null/undefined -> delete the doc.
    if (mark === null || mark === undefined) {
      await docRef.delete();
      return res.status(200).json({ success: true, message: 'Mark cleared', mark: null });
    }

    const payload = {
      mark: mark as PlayerMarkType,
      note: typeof note === 'string' && note.trim() ? note.trim() : FieldValue.delete(),
      season: resolvedSeason,
      updatedAt: FieldValue.serverTimestamp(),
    };

    await docRef.set(payload, { merge: true });

    return res.status(200).json({
      success: true,
      message: 'Mark saved',
      mark: {
        playerId,
        mark: mark as PlayerMarkType,
        note: typeof note === 'string' && note.trim() ? note.trim() : undefined,
        season: resolvedSeason,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error saving player mark:', error);
    return res.status(500).json({ success: false, message: 'Failed to save player mark' });
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GetMarksResponse | SetMarkResponse>
) {
  const decoded = await requireAuth(req);
  if (!decoded) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    return handleGet(req, res, decoded.uid);
  }

  if (req.method === 'POST') {
    return handlePost(req, res, decoded.uid);
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
}
