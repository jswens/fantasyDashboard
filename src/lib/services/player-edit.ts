// Applies a commissioner/admin edit (or a season cap-import row) directly to a
// players/{playerId} Firestore doc, appending an audit_history entry per
// changed field and marking those fields in edited_fields so a routine
// data/players.json refresh (see DataProcessor.createProcessedPlayersCache)
// won't silently clobber them.

import { adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { formatCapHit, normalizePlayerName } from '@/lib/services/cap-numbers';
import type {
  PlayerAuditEntry,
  PlayerDetail,
  PlayerEditableField,
  PlayerEditRequest,
} from '@/lib/types/playerEdit';

type StoredPlayer = Omit<PlayerDetail, 'isRostered' | 'rosterTeamName'>;

function buildSearchName(firstName: string, lastName: string): string {
  return normalizePlayerName(`${firstName} ${lastName}`);
}

/**
 * Diffs `edits` against the current player doc, appends one audit entry per
 * changed field, unions changed field names into edited_fields, and writes
 * the merged doc. Returns null if the player doesn't exist. Returns the
 * unchanged doc (no write) if nothing in `edits` actually differs.
 */
export async function editPlayerFields(
  playerId: string,
  edits: PlayerEditRequest,
  editor: { uid: string; email: string },
  source: 'manual-edit' | 'season-import'
): Promise<StoredPlayer | null> {
  const docRef = adminDb.collection('players').doc(playerId);
  const snap = await docRef.get();
  if (!snap.exists) return null;

  const current = snap.data() as StoredPlayer;
  const editedFields = new Set<PlayerEditableField>(current.edited_fields ?? []);
  const auditHistory: PlayerAuditEntry[] = current.audit_history ?? [];
  const newAuditEntries: PlayerAuditEntry[] = [];

  const next: StoredPlayer = { ...current };

  const recordChange = (
    field: PlayerEditableField,
    previousValue: string | number | null,
    newValue: string | number | null
  ) => {
    if (previousValue === newValue) return;
    editedFields.add(field);
    newAuditEntries.push({
      uid: editor.uid,
      email: editor.email,
      // Firestore forbids the serverTimestamp() sentinel inside an array,
      // so use a concrete Timestamp here (same pattern as the old cap-override endpoint).
      changedAt: Timestamp.now(),
      field,
      previousValue,
      newValue,
      source,
    });
  };

  if (edits.first_name !== undefined && edits.first_name !== current.first_name) {
    recordChange('first_name', current.first_name, edits.first_name);
    next.first_name = edits.first_name;
  }
  if (edits.last_name !== undefined && edits.last_name !== current.last_name) {
    recordChange('last_name', current.last_name, edits.last_name);
    next.last_name = edits.last_name;
  }
  if (edits.team !== undefined && edits.team !== current.team) {
    recordChange('team', current.team, edits.team);
    next.team = edits.team;
  }
  if (edits.cap_value !== undefined && edits.cap_value !== current.cap_value) {
    recordChange('cap_value', current.cap_value, edits.cap_value);
    next.cap_value = edits.cap_value;
  }

  if (newAuditEntries.length === 0) {
    return current;
  }

  next.search_name = buildSearchName(next.first_name, next.last_name);
  next.cap_value_formatted = formatCapHit(next.cap_value);
  next.has_zero_cap_warning = next.cap_value === 0;
  next.edited_fields = Array.from(editedFields);
  next.audit_history = [...auditHistory, ...newAuditEntries];

  await docRef.set(next, { merge: true });

  return next;
}

/** Bulk variant for the season CSV import — same semantics, chunked Firestore writes. */
export async function editPlayerFieldsBulk(
  edits: { playerId: string; edits: PlayerEditRequest }[],
  editor: { uid: string; email: string },
  source: 'manual-edit' | 'season-import'
): Promise<void> {
  const BATCH_SIZE = 500;
  for (let i = 0; i < edits.length; i += BATCH_SIZE) {
    const chunk = edits.slice(i, i + BATCH_SIZE);
    await Promise.all(chunk.map(({ playerId, edits: fieldEdits }) =>
      editPlayerFields(playerId, fieldEdits, editor, source)
    ));
  }
}

/** Firestore Timestamp doesn't survive res.json() as-is — normalize to an ISO string for the client. */
function serializeAuditEntry(entry: PlayerAuditEntry): PlayerAuditEntry {
  const changedAt = entry.changedAt;
  const isTimestamp = typeof changedAt === 'object' && changedAt !== null && 'toDate' in changedAt;
  return {
    ...entry,
    changedAt: isTimestamp ? (changedAt as Timestamp).toDate().toISOString() : changedAt,
  };
}

export function toPlayerDetail(
  stored: StoredPlayer,
  isRostered: boolean,
  rosterTeamName: string | undefined
): PlayerDetail {
  return {
    ...stored,
    edited_fields: stored.edited_fields ?? [],
    audit_history: (stored.audit_history ?? []).map(serializeAuditEntry),
    isRostered,
    rosterTeamName,
  };
}
