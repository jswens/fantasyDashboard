// GET/POST/DELETE /api/admin/commissioners
//
// Admin-only (see isAdmin in firebase-auth.ts — a broader role than
// commissioner). Lets admins grant or revoke commissioner access, stored as
// commissioners/{uid} docs (existence = commissioner, per isCommissioner in
// firebase-auth.ts). Granting looks the account up by email via the Auth
// Admin SDK so a commissioner can only be added for a user who has actually
// signed in at least once.

import type { NextApiRequest, NextApiResponse } from 'next';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth, isAdmin } from '@/lib/auth/firebase-auth';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import type { CommissionerEntry, CommissionersListResponse, CommissionerMutationResponse } from '@/lib/types/roles';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CommissionersListResponse | CommissionerMutationResponse>
) {
  const decoded = await requireAuth(req);
  if (!decoded) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  if (!(await isAdmin(decoded.uid))) {
    return res.status(403).json({ success: false, message: 'Forbidden - admin access required' });
  }

  if (req.method === 'GET') {
    try {
      const snap = await adminDb.collection('commissioners').get();
      const data: CommissionerEntry[] = await Promise.all(
        snap.docs.map(async doc => {
          const raw = doc.data() as Partial<Omit<CommissionerEntry, 'uid'>>;
          if (raw.email) {
            return { uid: doc.id, email: raw.email, addedBy: raw.addedBy ?? '', addedAt: raw.addedAt ?? null };
          }

          // Doc predates email tracking (e.g. created by hand). Backfill from
          // Auth so the list stays useful instead of showing a blank entry.
          let email = '(unknown — account no longer exists)';
          try {
            const userRecord = await adminAuth.getUser(doc.id);
            email = userRecord.email || email;
            await doc.ref.set(
              { email, addedBy: raw.addedBy ?? 'unknown', addedAt: raw.addedAt ?? FieldValue.serverTimestamp() },
              { merge: true }
            );
          } catch {
            // Leave the placeholder if the Auth user is gone too.
          }
          return { uid: doc.id, email, addedBy: raw.addedBy ?? 'unknown', addedAt: raw.addedAt ?? null };
        })
      );
      data.sort((a, b) => a.email.localeCompare(b.email));
      return res.status(200).json({ success: true, message: 'OK', data });
    } catch (error) {
      console.error('Error listing commissioners:', error);
      return res.status(500).json({ success: false, message: 'Failed to list commissioners' });
    }
  }

  if (req.method === 'POST') {
    const email = (req.body?.email as string | undefined)?.trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, message: 'email is required' });
    }

    try {
      const userRecord = await adminAuth.getUserByEmail(email);
      await adminDb.collection('commissioners').doc(userRecord.uid).set({
        email: userRecord.email || email,
        addedBy: decoded.uid,
        addedAt: FieldValue.serverTimestamp(),
      });
      return res.status(200).json({ success: true, message: `${email} is now a commissioner` });
    } catch (error) {
      if ((error as { code?: string }).code === 'auth/user-not-found') {
        return res.status(404).json({
          success: false,
          message: `No account found for ${email} — they need to sign in at least once first`,
        });
      }
      console.error('Error adding commissioner:', error);
      return res.status(500).json({ success: false, message: 'Failed to add commissioner' });
    }
  }

  if (req.method === 'DELETE') {
    const uid = (req.body?.uid as string | undefined)?.trim();
    if (!uid) {
      return res.status(400).json({ success: false, message: 'uid is required' });
    }

    try {
      await adminDb.collection('commissioners').doc(uid).delete();
      return res.status(200).json({ success: true, message: 'Commissioner removed' });
    } catch (error) {
      console.error('Error removing commissioner:', error);
      return res.status(500).json({ success: false, message: 'Failed to remove commissioner' });
    }
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
}
