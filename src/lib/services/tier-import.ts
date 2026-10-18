// Tier lists arrive as pasted text ("Tier 1: Player A, Player B") rather than
// as a file, but they are keyed and read back exactly like the CSV imports in
// csv-import.ts: by normalized player name, so an admin's spelling
// ("Anthony Hill Jr.", "T.J. Watt") still matches the Sleeper spelling.

import { normalizePlayerName } from '@/lib/services/cap-numbers';

export interface TierRow {
  playerName: string;
  tier: number;
  position: number; // position within tier
}

export interface StoredTier {
  playerName: string;
  tier: number;
  position: number; // position within tier
}

/** Shape of a cache/tiers entry, which may predate the normalized keys. */
interface StoredTierEntry {
  playerName?: string;
  tier?: number;
  position?: number;
}

/** Parses "Tier X: Player1, Player2" lines, ignoring anything else. */
export function parseTierText(tierText: string): TierRow[] {
  const rows: TierRow[] = [];

  const lines = tierText.split('\n').filter(line => line.trim());

  for (const line of lines) {
    const tierMatch = line.trim().match(/^Tier\s+(\d+):\s*(.+)$/i);
    if (!tierMatch) continue;

    const tier = parseInt(tierMatch[1]);
    const players = tierMatch[2]
      .split(',')
      .map(player => player.trim())
      .filter(player => player);

    console.log(`[TIER_UPLOAD] Tier ${tier}: ${players.length} players`);

    players.forEach((playerName, index) => {
      rows.push({ playerName, tier, position: index + 1 });
    });
  }

  return rows;
}

/** True when `candidate` outranks `incumbent`: lower tier, then earlier in it. */
function isBetterTier(candidate: TierRow, incumbent: StoredTier): boolean {
  if (candidate.tier !== incumbent.tier) return candidate.tier < incumbent.tier;
  return candidate.position < incumbent.position;
}

/**
 * Keys tiers by normalized name. On duplicates the better placement wins
 * (lower tier, then earlier within that tier) rather than whichever line was
 * pasted last.
 */
export function buildTierMap(rows: TierRow[]): Record<string, StoredTier> {
  const tiers: Record<string, StoredTier> = {};

  rows.forEach(row => {
    const key = normalizePlayerName(row.playerName);
    if (!key) return;

    const existing = tiers[key];
    if (existing && !isBetterTier(row, existing)) return;

    tiers[key] = {
      playerName: row.playerName,
      tier: row.tier,
      position: row.position,
    };
  });

  return tiers;
}

/**
 * Re-keys a stored tiers map by normalized name as it is read, for the same
 * reason as normalizeStoredProjectionMap in csv-import.ts: the free agents
 * endpoint only reads, and a tier list pasted before this change is keyed by
 * raw name and must keep matching. Normalizing is idempotent, so maps written
 * by buildTierMap pass through unchanged.
 */
export function normalizeStoredTierMap(
  stored: Record<string, StoredTierEntry>
): Record<string, StoredTier> {
  const rows: TierRow[] = [];

  Object.entries(stored || {}).forEach(([storedKey, entry]) => {
    if (!entry || typeof entry.tier !== 'number') return;

    // Entries written before the re-keying have no playerName — their key was
    // the raw pasted name.
    rows.push({
      playerName: entry.playerName || storedKey,
      tier: entry.tier,
      position: entry.position ?? 0,
    });
  });

  return buildTierMap(rows);
}
