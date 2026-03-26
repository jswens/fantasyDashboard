import type { NextApiRequest } from 'next';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function verifyIdToken(idToken: string): Promise<DecodedIdToken | null> {
  try {
    return await adminAuth.verifyIdToken(idToken);
  } catch {
    return null;
  }
}

export async function isAdmin(uid: string): Promise<boolean> {
  try {
    const doc = await adminDb.collection('admins').doc(uid).get();
    return doc.exists;
  } catch {
    return false;
  }
}

export async function requireAuth(req: NextApiRequest): Promise<DecodedIdToken | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const idToken = authHeader.replace('Bearer ', '');
  return verifyIdToken(idToken);
}

export async function requireAdmin(req: NextApiRequest): Promise<boolean> {
  const decoded = await requireAuth(req);
  if (!decoded) return false;
  return isAdmin(decoded.uid);
}
