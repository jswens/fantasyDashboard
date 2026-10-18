// Format detection for the single "Upload CSV" button on the free agents page.
// Two shapes are supported today, both keyed off the header row rather than
// column position, so a fresh export from the same source keeps working:
//
//   projections     Player,Team,Big3 FFPTS             -> cache/projections
//   expertRankings  Rank,Player Name,Team,Position,ECR -> cache/expertRankings
//
// FantasyPros exports carry a title/blank-line preamble above the real header,
// so the header row is discovered rather than assumed to be line 1.

import { normalizePlayerName } from '@/lib/services/cap-numbers';

export type CsvImportFormat = 'projections' | 'expertRankings';

export interface ProjectionRow {
  playerName: string;
  team: string;
  projection: number;
}

export interface ExpertRankingRow {
  playerName: string;
  team: string;
  position: string;
  rank: number;
  ecr: number | null;
  vsEcr: number | null;
}

export type CsvImportResult =
  | { format: 'projections'; rows: ProjectionRow[]; positions: string[] }
  | { format: 'expertRankings'; rows: ExpertRankingRow[]; positions: string[] };

const PLAYER_NAME_OPTIONS = ['player', 'name', 'full_name', 'player_name'];
const TEAM_OPTIONS = ['team', 'pos'];
const PROJECTION_OPTIONS = ['projection', 'projections', 'points', 'pts', 'big3 ffpts', 'ffpts'];
const RANK_OPTIONS = ['rank', 'rk', 'overall', 'ovr'];

/** Splits one CSV row, honouring quoted cells (exports quote names containing commas). */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells.map(cell => cell.trim());
}

/** First header index whose cell matches any of `options`, or -1. */
function findColumn(headers: string[], options: string[], exact = false): number {
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    if (!header) continue;
    if (options.some(option => (exact ? header === option : header.includes(option)))) {
      return i;
    }
  }
  return -1;
}

interface HeaderMatch {
  lineIndex: number;
  playerNameIndex: number;
  teamIndex: number;
  projectionIndex: number;
  rankIndex: number;
  positionIndex: number;
  ecrIndex: number;
  vsEcrIndex: number;
}

function inspectHeader(headers: string[], lineIndex: number): HeaderMatch {
  return {
    lineIndex,
    playerNameIndex: findColumn(headers, PLAYER_NAME_OPTIONS),
    teamIndex: findColumn(headers, TEAM_OPTIONS, true),
    projectionIndex: findColumn(headers, PROJECTION_OPTIONS),
    rankIndex: findColumn(headers, RANK_OPTIONS, true),
    positionIndex: findColumn(headers, ['position', 'pos', 'truepos'], true),
    ecrIndex: findColumn(headers, ['ecr'], true),
    vsEcrIndex: findColumn(headers, ['vs. ecr', 'vs ecr']),
  };
}

/**
 * Scans the first rows for a header: a player-name column plus something to
 * rank by. Anything above it (report titles, blank lines) is preamble.
 */
function findHeaderRow(lines: string[]): HeaderMatch | null {
  const limit = Math.min(lines.length, 15);

  for (let i = 0; i < limit; i++) {
    const headers = splitCsvLine(lines[i]).map(cell => cell.toLowerCase());
    const match = inspectHeader(headers, i);

    const hasValueColumn =
      match.projectionIndex !== -1 || match.rankIndex !== -1 || match.ecrIndex !== -1;

    if (match.playerNameIndex !== -1 && hasValueColumn) {
      return match;
    }
  }

  return null;
}

function parseNumber(cell: string | undefined): number | null {
  // Deltas arrive as "+3" / "-1", and blanks as an empty cell or "-".
  if (!cell) return null;
  const cleaned = cell.replace(/[+,]/g, '').trim();
  if (!cleaned || cleaned === '-') return null;
  const value = parseFloat(cleaned);
  return isNaN(value) ? null : value;
}

function collectPositions(rows: ExpertRankingRow[]): string[] {
  const seen = new Set<string>();
  rows.forEach(row => {
    if (row.position) seen.add(row.position);
  });
  return Array.from(seen).sort();
}

function parseProjectionRows(
  lines: string[],
  dataStart: number,
  playerNameIndex: number,
  teamIndex: number,
  projectionIndex: number
): ProjectionRow[] {
  const rows: ProjectionRow[] = [];

  for (let i = dataStart; i < lines.length; i++) {
    const columns = splitCsvLine(lines[i]);
    const playerName = columns[playerNameIndex];
    const projection = parseNumber(columns[projectionIndex]);

    if (playerName && projection !== null && projection > 0) {
      rows.push({
        playerName,
        team: columns[teamIndex] || '',
        projection,
      });
    }
  }

  return rows;
}

function parseExpertRankingRows(
  lines: string[],
  dataStart: number,
  header: HeaderMatch
): ExpertRankingRow[] {
  const rows: ExpertRankingRow[] = [];
  let fallbackRank = 0;

  for (let i = dataStart; i < lines.length; i++) {
    const columns = splitCsvLine(lines[i]);
    const playerName = header.playerNameIndex === -1 ? '' : columns[header.playerNameIndex];
    if (!playerName) continue;

    const ecr = header.ecrIndex === -1 ? null : parseNumber(columns[header.ecrIndex]);
    const explicitRank = header.rankIndex === -1 ? null : parseNumber(columns[header.rankIndex]);
    // Some exports only carry ECR; fall back to file order so every row ranks.
    const rank = explicitRank ?? ecr ?? ++fallbackRank;

    rows.push({
      playerName,
      team: header.teamIndex === -1 ? '' : columns[header.teamIndex] || '',
      position:
        header.positionIndex === -1 ? '' : (columns[header.positionIndex] || '').toUpperCase(),
      rank,
      ecr,
      vsEcr: header.vsEcrIndex === -1 ? null : parseNumber(columns[header.vsEcrIndex]),
    });
  }

  return rows;
}

/**
 * Parses an uploaded CSV, trying each supported format. Throws when nothing
 * usable is found so the caller can report it back to the uploader.
 */
export function parseImportCsv(csvContent: string): CsvImportResult {
  const lines = csvContent
    .replace(/^﻿/, '')
    .split('\n')
    .map(line => line.replace(/\r$/, ''))
    .filter(line => line.trim());

  if (lines.length === 0) {
    throw new Error('The file is empty');
  }

  const header = findHeaderRow(lines);

  // Headerless file: the original three-column projection layout.
  if (!header) {
    const rows = parseProjectionRows(lines, 1, 0, 1, 2);
    if (rows.length === 0) {
      throw new Error('Could not recognize the columns in this file');
    }
    return { format: 'projections', rows, positions: [] };
  }

  const dataStart = header.lineIndex + 1;

  // Projections win when a points column exists — that is the long-standing
  // format, and some exports carry both points and a rank column.
  if (header.projectionIndex !== -1) {
    const rows = parseProjectionRows(
      lines,
      dataStart,
      header.playerNameIndex,
      header.teamIndex === -1 ? 1 : header.teamIndex,
      header.projectionIndex
    );
    if (rows.length > 0) {
      return { format: 'projections', rows, positions: [] };
    }
  }

  if (header.rankIndex !== -1 || header.ecrIndex !== -1) {
    const rows = parseExpertRankingRows(lines, dataStart, header);
    if (rows.length > 0) {
      return { format: 'expertRankings', rows, positions: collectPositions(rows) };
    }
  }

  throw new Error('No valid rows found — expected a points column or a rank column');
}

export interface StoredExpertRanking {
  playerName: string;
  team: string;
  position: string;
  rank: number;
  ecr: number | null;
  vsEcr: number | null;
}

/**
 * Keys rankings by normalized name so "Anthony Hill Jr." and "T.J. Watt" line
 * up with the Sleeper spelling. Keeps the best (lowest) rank on duplicates.
 */
export function buildExpertRankingMap(
  rows: ExpertRankingRow[]
): Record<string, StoredExpertRanking> {
  const rankings: Record<string, StoredExpertRanking> = {};

  rows.forEach(row => {
    const key = normalizePlayerName(row.playerName);
    if (!key) return;

    const existing = rankings[key];
    if (existing && existing.rank <= row.rank) return;

    rankings[key] = {
      playerName: row.playerName,
      team: row.team,
      position: row.position,
      rank: row.rank,
      ecr: row.ecr,
      vsEcr: row.vsEcr,
    };
  });

  return rankings;
}
