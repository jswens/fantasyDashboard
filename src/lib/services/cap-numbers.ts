// Resolves "effective" cap numbers for players by layering:
//   1. Admin manual override (capNumbers/{season}/overrides/{playerId}) — highest priority
//   2. Season import (capNumbers/{season}, written by /api/admin/import-cap-numbers)
//   3. Legacy static data/capsheet.csv (via DataProcessor / the `players` Firestore cache)
//
// This lets existing pages (free-agents, team pages) keep working unchanged when no
// Firestore import has been run yet for the current season, while giving the new
// player search / draft tools a single place to ask "what does this player cost".

import { adminDb } from '@/lib/firebase-admin';
import type { CapImportDocument, CapOverrideDocument, EffectiveCapNumber, CapSource } from '@/lib/types/cap';

export function getCurrentCapSeason(): string {
  // The NFL league year used for cap purposes; overridable via env for testing/off-season prep.
  return process.env.CAP_SEASON || new Date().getFullYear().toString();
}

export function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/\./g, '') // periods (e.g. "D.J.")
    .replace(/'/g, '') // apostrophes
    .replace(/\s+(jr|sr|ii|iii|iv|v)$/i, '') // suffixes
    .replace(/[^a-z0-9\s]/g, '') // remaining punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

interface CapLayers {
  season: string;
  importDoc: CapImportDocument | null;
  overrides: Map<string, CapOverrideDocument>;
}

/** Loads the import doc + overrides subcollection for a season once, for reuse across many lookups. */
export async function loadCapLayers(season: string = getCurrentCapSeason()): Promise<CapLayers> {
  const capDocRef = adminDb.collection('capNumbers').doc(season);

  const [docSnap, overridesSnap] = await Promise.all([
    capDocRef.get(),
    capDocRef.collection('overrides').get(),
  ]);

  const importDoc = docSnap.exists ? (docSnap.data() as CapImportDocument) : null;

  const overrides = new Map<string, CapOverrideDocument>();
  overridesSnap.forEach(doc => {
    overrides.set(doc.id, doc.data() as CapOverrideDocument);
  });

  return { season, importDoc, overrides };
}

/**
 * Resolves the effective cap number for a single player given preloaded layers.
 * `legacyCapValue` should come from the existing `players` Firestore cache
 * (SleeperPlayer & { cap_value }) so pages keep working pre-import.
 */
export function resolveEffectiveCapNumber(
  playerId: string,
  layers: CapLayers,
  legacyCapValue: number | undefined
): EffectiveCapNumber {
  const override = layers.overrides.get(playerId);
  if (override) {
    return { capHit: override.capHit, source: 'override' };
  }

  const imported = layers.importDoc?.players?.[playerId];
  if (imported) {
    return { capHit: imported.capHit, source: 'import' };
  }

  if (typeof legacyCapValue === 'number' && legacyCapValue > 0) {
    return { capHit: legacyCapValue, source: 'legacy-csv' };
  }

  return { capHit: legacyCapValue ?? 0, source: legacyCapValue !== undefined ? 'legacy-csv' : 'none' };
}

/** Convenience: resolve a single player's effective cap number, loading layers on demand. */
export async function getEffectiveCapNumber(
  playerId: string,
  legacyCapValue: number | undefined,
  season: string = getCurrentCapSeason()
): Promise<EffectiveCapNumber> {
  const layers = await loadCapLayers(season);
  return resolveEffectiveCapNumber(playerId, layers, legacyCapValue);
}

export function formatCapHit(capHit: number): string {
  return `$${capHit.toLocaleString('en-US')}`;
}

export type { CapSource };
