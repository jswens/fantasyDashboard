// POST /api/admin/import-cap-numbers
//
// Admin or commissioner. Imports NFL cap-hit numbers for a season and writes them to
// Firestore at capNumbers/{season}, replacing the static data/capsheet.csv
// as the source of truth for that season going forward (capsheet.csv remains
// a fallback for seasons that have never been imported — see
// src/lib/services/cap-numbers.ts).
//
// Source: CSV upload (primary path).
//
// Why CSV upload instead of live-scraping OverTheCap.com:
//   - OverTheCap has no public CSV export or free API for player-level cap hits.
//     Their "OTC API" (https://overthecap.com/otc-api) is gated behind an OTC
//     Premium subscription; without it there's no documented, stable endpoint.
//   - Player-level cap numbers only appear on per-team pages
//     (https://overthecap.com/salary-cap/{team-slug}, e.g.
//     https://overthecap.com/salary-cap/dallas-cowboys), meaning a scraper would
//     need to hit all 32 team pages, parse HTML tables with no export affordance,
//     and re-scrape every time their markup changes.
//   - A once-a-season manual CSV export (copy/paste the team table into a
//     spreadsheet, or use a community tool like nflreadr's load_contracts()
//     which itself sources from OverTheCap) is far more reliable than a fragile
//     scraper for something that only runs once per year.
//
// Expected CSV columns (header row required, case-insensitive, order-independent):
//   name (or player/player_name), team, position (or pos), cap hit (or cap_hit/salary_cap/cap)
//
// Guard rail: if capNumbers/{season} already exists, the import still proceeds
// (re-imports are expected season-to-season and overrides live in a separate
// subcollection that this never touches) but the response includes a warning.

import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import { requireAuth, isAdmin, isCommissioner } from '@/lib/auth/firebase-auth';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { normalizePlayerName, getCurrentCapSeason } from '@/lib/services/cap-numbers';
import type {
  CapImportEntry,
  CapImportResponse,
  CapImportRow,
} from '@/lib/types/cap';
import type { SleeperPlayer } from '@/lib/types/sleeper';

export const config = {
  api: {
    bodyParser: false,
  },
};

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function findColumnIndex(headers: string[], options: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    if (options.some(option => headers[i] === option)) return i;
  }
  for (let i = 0; i < headers.length; i++) {
    if (options.some(option => headers[i].includes(option))) return i;
  }
  return -1;
}

export function parseCapCSV(csvContent: string): CapImportRow[] {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());

  const nameIdx = findColumnIndex(headers, ['name', 'player', 'player_name', 'player name']);
  const teamIdx = findColumnIndex(headers, ['team']);
  const posIdx = findColumnIndex(headers, ['position', 'pos']);
  const capIdx = findColumnIndex(headers, ['cap hit', 'cap_hit', 'caphit', 'salary_cap', 'salary cap', 'cap number', 'cap_number', 'cap']);

  if (nameIdx === -1 || capIdx === -1) {
    return [];
  }

  const rows: CapImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const columns = parseCSVLine(lines[i]);
    if (columns.length <= Math.max(nameIdx, capIdx)) continue;

    const rawName = columns[nameIdx]?.trim();
    if (!rawName) continue;

    const capRaw = columns[capIdx]?.trim() || '0';
    const capHit = parseInt(capRaw.replace(/[$,]/g, ''), 10) || 0;

    rows.push({
      rawName,
      normalizedName: normalizePlayerName(rawName),
      team: teamIdx !== -1 ? (columns[teamIdx]?.trim() || '') : '',
      position: posIdx !== -1 ? (columns[posIdx]?.trim() || '') : '',
      capHit,
    });
  }

  return rows;
}

/** Matches an import row to a Sleeper player_id by normalized name (+ team when available). */
function matchRowToPlayer(
  row: CapImportRow,
  playersByNormalizedName: Map<string, { playerId: string; player: SleeperPlayer }[]>
): string | null {
  const candidates = playersByNormalizedName.get(row.normalizedName);
  if (!candidates || candidates.length === 0) return null;

  if (candidates.length === 1) return candidates[0].playerId;

  // Multiple Sleeper players share this normalized name — disambiguate by team if we have one.
  if (row.team) {
    const rowTeamUpper = row.team.toUpperCase();
    const teamMatch = candidates.find(
      c => c.player.team && rowTeamUpper.includes(c.player.team.toUpperCase())
    );
    if (teamMatch) return teamMatch.playerId;
  }

  // Fall back to first candidate rather than dropping the row entirely.
  return candidates[0].playerId;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CapImportResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const decoded = await requireAuth(req);
  if (!decoded) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  const [adminStatus, commissionerStatus] = await Promise.all([
    isAdmin(decoded.uid),
    isCommissioner(decoded.uid),
  ]);
  if (!adminStatus && !commissionerStatus) {
    return res.status(403).json({ success: false, message: 'Forbidden - admin or commissioner access required' });
  }

  try {
    const form = formidable({ maxFileSize: 5 * 1024 * 1024 });
    const [fields, files] = await form.parse(req);

    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) {
      return res.status(400).json({ success: false, message: 'No CSV file uploaded (expected form field "file")' });
    }

    const seasonField = Array.isArray(fields.season) ? fields.season[0] : fields.season;
    const season = seasonField?.trim() || getCurrentCapSeason();

    const csvContent = fs.readFileSync(file.filepath, 'utf8');
    const rows = parseCapCSV(csvContent);

    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid cap data found in file. Expected a header row with name and cap hit columns.',
      });
    }

    // Load Sleeper players from Firestore cache to match against.
    const playersSnap = await adminDb.collection('players').get();
    if (playersSnap.empty) {
      return res.status(400).json({
        success: false,
        message: 'No processed players found in Firestore. Run a data refresh before importing cap numbers.',
      });
    }

    const playersByNormalizedName = new Map<string, { playerId: string; player: SleeperPlayer }[]>();
    playersSnap.forEach(doc => {
      const player = doc.data() as SleeperPlayer;
      const normalized = normalizePlayerName(`${player.first_name} ${player.last_name}`);
      const list = playersByNormalizedName.get(normalized) || [];
      list.push({ playerId: doc.id, player });
      playersByNormalizedName.set(normalized, list);
    });

    const matchedPlayers: Record<string, CapImportEntry> = {};
    const unmatched: CapImportEntry[] = [];
    const zeroOrMissing: { name: string; playerId: string | null }[] = [];

    for (const row of rows) {
      const playerId = matchRowToPlayer(row, playersByNormalizedName);
      const entry: CapImportEntry = {
        rawName: row.rawName,
        normalizedName: row.normalizedName,
        team: row.team,
        position: row.position,
        capHit: row.capHit,
        matchedPlayerId: playerId,
      };

      if (playerId) {
        matchedPlayers[playerId] = entry;
      } else {
        unmatched.push(entry);
      }

      if (row.capHit <= 0) {
        zeroOrMissing.push({ name: row.rawName, playerId });
      }
    }

    // Guard rail: warn (don't block) if this season already has an import.
    const existingDoc = await adminDb.collection('capNumbers').doc(season).get();
    const alreadyImported = existingDoc.exists;

    const metadata = {
      season,
      source: 'manual-csv' as const,
      importedAt: FieldValue.serverTimestamp(),
      importedBy: decoded.uid,
      rowCount: rows.length,
      matchedCount: Object.keys(matchedPlayers).length,
      unmatchedCount: unmatched.length,
      zeroOrMissingCount: zeroOrMissing.length,
    };

    await adminDb.collection('capNumbers').doc(season).set({
      metadata,
      players: matchedPlayers,
      unmatched,
    });

    const report = {
      season,
      totalRows: rows.length,
      matchedCount: Object.keys(matchedPlayers).length,
      unmatchedCount: unmatched.length,
      unmatchedNames: unmatched.map(u => u.rawName),
      zeroOrMissingCapHitPlayers: zeroOrMissing,
      alreadyImported,
    };

    const warningSuffix = alreadyImported
      ? ` Warning: cap numbers for season ${season} already existed and have been replaced (overrides were preserved).`
      : '';

    return res.status(200).json({
      success: true,
      message: `Imported ${rows.length} cap rows for season ${season}: ${report.matchedCount} matched, ${report.unmatchedCount} unmatched.${warningSuffix}`,
      report,
    });
  } catch (error) {
    console.error('Error processing cap import:', error);
    return res.status(500).json({ success: false, message: 'Failed to process cap import' });
  }
}
