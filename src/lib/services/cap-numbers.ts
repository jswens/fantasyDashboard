// A player's cap hit lives directly on players/{playerId}.cap_value — see
// src/lib/services/player-edit.ts for how commissioner edits and season CSV
// imports both write to that field (with an audit trail), and
// src/lib/services/data-processor.ts for how the routine data/players.json
// refresh preserves any commissioner-edited field instead of clobbering it.

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

export function formatCapHit(capHit: number): string {
  return `$${capHit.toLocaleString('en-US')}`;
}
