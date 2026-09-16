// POST /api/auth/dev-login -- LOCAL DEVELOPMENT ONLY.
//
// Mints a Firebase custom token for a fixed test user so the app can be
// signed into without a Google popup (for automated/browser testing). The
// client exchanges it with signInWithCustomToken.
//
// Three independent gates, all required:
//   1. NODE_ENV === 'development' -- `next build`/`next start` (and so every
//      deployed environment) always runs as production.
//   2. NEXT_PUBLIC_DEV_TEST_LOGIN=true -- opt-in, set only in .env.local.
//   3. The request comes from the loopback interface, so a dev server exposed
//      on the LAN doesn't hand out sessions to other machines.
// Anything else gets a 404, as if the route didn't exist.
//
// The test user has no admin/commissioner role unless you add its uid to
// those Firestore collections yourself.

import type { NextApiRequest, NextApiResponse } from 'next';
import { adminAuth } from '@/lib/firebase-admin';

export const DEV_TEST_UID = 'dev-test-user';

function isLoopback(address: string | undefined): boolean {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

export function isDevLoginEnabled(): boolean {
  return (
    process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEV_TEST_LOGIN === 'true'
  );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ token: string } | { error: string }>
) {
  if (!isDevLoginEnabled() || !isLoopback(req.socket.remoteAddress)) {
    return res.status(404).json({ error: 'Not found' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store');

  try {
    const token = await adminAuth.createCustomToken(DEV_TEST_UID, { dev_test: true });
    res.status(200).json({ token });
  } catch (error) {
    console.error('Error minting dev test token:', error);
    res.status(500).json({ error: 'Failed to mint dev test token' });
  }
}
