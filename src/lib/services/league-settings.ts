// Resolves the league-wide salary cap, stored per-season at
// leagueSettings/{season} so it can be changed year to year without a
// deploy. Mirrors the audit-trail pattern used for per-player cap overrides
// (see cap-numbers.ts / api/admin/cap-override.ts): every write keeps the
// previous value and a full history on the document itself.

import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { getCurrentCapSeason } from './cap-numbers';
import type { LeagueCapDocument } from '@/lib/types/cap';

// Used only until a commissioner sets a cap for the season via the
// Commissioner page (POST /api/admin/league-cap).
export const DEFAULT_SALARY_CAP = 201000000; // $201M

function leagueSettingsRef(season: string) {
  return adminDb.collection('leagueSettings').doc(season);
}

export async function getLeagueSalaryCap(
  season: string = getCurrentCapSeason()
): Promise<{ season: string; salaryCap: number; isDefault: boolean }> {
  try {
    const snap = await leagueSettingsRef(season).get();
    if (snap.exists) {
      const data = snap.data() as LeagueCapDocument;
      if (typeof data.salaryCap === 'number' && data.salaryCap > 0) {
        return { season, salaryCap: data.salaryCap, isDefault: false };
      }
    }
  } catch (error) {
    console.error('Error loading league salary cap, falling back to default:', error);
  }
  return { season, salaryCap: DEFAULT_SALARY_CAP, isDefault: true };
}

export async function getLeagueCapDetail(
  season: string = getCurrentCapSeason()
): Promise<LeagueCapDocument | null> {
  const snap = await leagueSettingsRef(season).get();
  return snap.exists ? (snap.data() as LeagueCapDocument) : null;
}

export async function setLeagueSalaryCap(
  season: string,
  salaryCap: number,
  uid: string
): Promise<LeagueCapDocument> {
  const ref = leagueSettingsRef(season);
  const existingSnap = await ref.get();
  const existing = existingSnap.exists ? (existingSnap.data() as LeagueCapDocument) : null;
  const previousValue = existing?.salaryCap ?? null;

  const auditEntry = {
    uid,
    // Firestore forbids the FieldValue.serverTimestamp() sentinel inside an
    // array, so use a concrete Timestamp here (top-level updatedAt below can
    // still use the sentinel).
    changedAt: Timestamp.now(),
    previousValue,
    newValue: salaryCap,
  };

  const newDoc: Omit<LeagueCapDocument, 'history'> & { history: unknown[] } = {
    season,
    salaryCap,
    updatedBy: uid,
    updatedAt: FieldValue.serverTimestamp(),
    previousValue,
    history: [...(existing?.history || []), auditEntry],
  };

  await ref.set(newDoc);
  return newDoc as LeagueCapDocument;
}
