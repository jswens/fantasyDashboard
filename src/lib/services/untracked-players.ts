// "Untracked" players are on a Sleeper roster in the league but have no
// players/{playerId} doc -- usually because data/players.json was built while
// Sleeper had them teamless. SleeperService flags them on each Team; this module
// fills in their names for the alerts and lets a commissioner add one.
//
// Names come from Sleeper's full player dump, which is ~5MB and meant to be
// fetched rarely, so the few entries we need are cached in a single Firestore
// doc and the dump is only re-fetched for IDs we haven't seen (or, when adding
// a player, for entries older than a day).

import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { SleeperService } from '@/lib/services/sleeper-api';
import { formatCapHit, normalizePlayerName } from '@/lib/services/cap-numbers';
import type { Team } from '@/lib/types';
import type { SleeperRawPlayer } from '@/lib/types/sleeper';
import type { PlayerAuditEntry, PlayerEditableField } from '@/lib/types/playerEdit';

const LOOKUP_DOC = 'cache/sleeperPlayerLookup';
const ADD_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Same fantasy-position rule as draft-helper/build_player_data.py, so a
// manually added player is grouped the same way as everyone else.
const FANTASY_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DL', 'LB', 'DB'];

interface LookupEntry {
  found: boolean;
  first_name: string;
  last_name: string;
  position: string | null;
  team: string | null;
  years_exp: number | null;
  fetchedAt: number;
}

function toLookupEntry(raw: SleeperRawPlayer | undefined, fetchedAt: number): LookupEntry {
  if (!raw) {
    return { found: false, first_name: '', last_name: '', position: null, team: null, years_exp: null, fetchedAt };
  }
  const fantasyPosition = (raw.fantasy_positions ?? []).find(p => FANTASY_POSITIONS.includes(p));
  return {
    found: true,
    first_name: raw.first_name ?? '',
    last_name: raw.last_name ?? '',
    position: fantasyPosition ?? raw.position ?? null,
    team: raw.team ?? null,
    years_exp: raw.years_exp ?? null,
    fetchedAt,
  };
}

async function lookupSleeperPlayers(ids: string[], maxAgeMs?: number): Promise<Map<string, LookupEntry>> {
  const result = new Map<string, LookupEntry>();
  if (ids.length === 0) return result;

  const snap = await adminDb.doc(LOOKUP_DOC).get();
  const cached = (snap.data()?.players ?? {}) as Record<string, LookupEntry>;
  const now = Date.now();

  const needed = ids.filter(id => {
    const entry = cached[id];
    if (!entry) return true;
    return maxAgeMs !== undefined && now - entry.fetchedAt > maxAgeMs;
  });

  if (needed.length > 0) {
    const leagueId = process.env.NEXT_PUBLIC_SLEEPER_LEAGUE_ID ?? '';
    const all = await new SleeperService(leagueId).getAllPlayers();
    if (all) {
      const updates: Record<string, LookupEntry> = {};
      for (const id of needed) updates[id] = toLookupEntry(all[id], now);
      await adminDb.doc(LOOKUP_DOC).set({ players: updates }, { merge: true });
      Object.assign(cached, updates);
    }
  }

  for (const id of ids) {
    if (cached[id]) result.set(id, cached[id]);
  }
  return result;
}

/** Fills in missing names on each team's untracked_players, in place. Never throws. */
export async function resolveUntrackedPlayerNames(teams: Team[]): Promise<void> {
  const unnamed = teams.flatMap(t => (t.untracked_players ?? []).filter(p => !p.full_name));
  if (unnamed.length === 0) return;

  try {
    const lookup = await lookupSleeperPlayers(unnamed.map(p => p.player_id));
    for (const p of unnamed) {
      const entry = lookup.get(p.player_id);
      if (!entry?.found) continue;
      p.full_name = `${entry.first_name} ${entry.last_name}`.trim() || null;
      p.position = entry.position;
      p.nfl_team = entry.team;
    }
  } catch (error) {
    console.error('Error resolving untracked player names:', error);
  }
}

export type AddPlayerResult =
  | { status: 'added'; fullName: string }
  | { status: 'exists' }
  | { status: 'not_found' }
  | { status: 'sleeper_unavailable' };

/**
 * Creates players/{playerId} from Sleeper's current data. Names/team are
 * recorded in the audit history as a manual add; cap_value, when given, is
 * also marked as edited so a later data/players.json refresh keeps it. The doc
 * isn't in data/players.json, so that refresh otherwise leaves it alone.
 */
export async function addPlayerFromSleeper(
  playerId: string,
  capValue: number | null,
  editor: { uid: string; email: string }
): Promise<AddPlayerResult> {
  const docRef = adminDb.collection('players').doc(playerId);
  if ((await docRef.get()).exists) return { status: 'exists' };

  const entry = (await lookupSleeperPlayers([playerId], ADD_MAX_AGE_MS)).get(playerId);
  if (!entry) return { status: 'sleeper_unavailable' };
  if (!entry.found) return { status: 'not_found' };

  const cap = capValue ?? 0;
  const changedAt = Timestamp.now();
  const audit = (field: PlayerEditableField, newValue: string | number | null): PlayerAuditEntry => ({
    uid: editor.uid,
    email: editor.email,
    changedAt,
    field,
    previousValue: null,
    newValue,
    source: 'manual-add',
  });

  const auditHistory: PlayerAuditEntry[] = [
    audit('first_name', entry.first_name),
    audit('last_name', entry.last_name),
    audit('team', entry.team),
  ];
  const editedFields: PlayerEditableField[] = [];
  if (capValue !== null) {
    auditHistory.push(audit('cap_value', capValue));
    editedFields.push('cap_value');
  }

  const fullName = `${entry.first_name} ${entry.last_name}`.trim();
  try {
    await docRef.create({
      player_id: playerId,
      first_name: entry.first_name,
      last_name: entry.last_name,
      team: entry.team,
      position: entry.position ?? '',
      years_exp: entry.years_exp,
      active: true,
      cap_value: cap,
      cap_value_formatted: formatCapHit(cap),
      search_name: normalizePlayerName(fullName),
      has_zero_cap_warning: cap === 0,
      edited_fields: editedFields,
      audit_history: auditHistory,
    });
  } catch (error) {
    // gRPC ALREADY_EXISTS: someone else added the player between our check and create.
    if ((error as { code?: number }).code === 6) return { status: 'exists' };
    throw error;
  }

  return { status: 'added', fullName };
}
