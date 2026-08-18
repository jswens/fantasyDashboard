import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, isAdmin, isCommissioner } from '@/lib/auth/firebase-auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const decoded = await requireAuth(req);
  if (!decoded) {
    return res.status(401).json({ isAdmin: false, isCommissioner: false });
  }

  const [adminStatus, commissionerStatus] = await Promise.all([
    isAdmin(decoded.uid),
    isCommissioner(decoded.uid),
  ]);
  return res.status(200).json({ isAdmin: adminStatus, isCommissioner: commissionerStatus, uid: decoded.uid });
}
