import { MatchupPlayer, MatchupSide } from '@/lib/types/matchup';
import { isEfficiencyEligible } from '@/lib/utils/efficiency';

// Fallback only. The league's real slot list ships on the scoreboard as
// starting_slots (derived from roster_positions), and that is what callers
// pass in -- a hardcoded copy would silently mislabel every lineup if the
// commissioner ever changed the roster settings. This is used only for a
// cached scoreboard written before starting_slots existed.
export const FALLBACK_SLOT_LABELS: readonly string[] = [
  'QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'SUPER_FLEX', 'IDP_FLEX', 'K', 'DL', 'DL', 'LB', 'LB', 'DB', 'DB',
];

export interface SlotRow {
  slotIndex: number;
  label: string;
  left: MatchupPlayer | null;
  right: MatchupPlayer | null;
}

// Builds one row per starting slot, aligning both sides by slot_index rather
// than by array position -- a side's players[] isn't guaranteed to be sorted,
// and a side can legitimately be missing a starter in a slot (bye, injury
// left a hole). Missing players become null cells; the row itself always
// renders so the two sides never drift out of alignment.
export function buildSlotRows(
  slotLabels: readonly string[],
  left: MatchupSide,
  right: MatchupSide
): SlotRow[] {
  const labels = slotLabels.length > 0 ? slotLabels : FALLBACK_SLOT_LABELS;
  const bySlot = (side: MatchupSide) => {
    const map = new Map<number, MatchupPlayer>();
    for (const player of side.players) {
      if (player.is_starter && player.slot_index !== null) {
        map.set(player.slot_index, player);
      }
    }
    return map;
  };

  const leftBySlot = bySlot(left);
  const rightBySlot = bySlot(right);

  return labels.map((label, slotIndex) => ({
    slotIndex,
    label,
    left: leftBySlot.get(slotIndex) ?? null,
    right: rightBySlot.get(slotIndex) ?? null,
  }));
}

export type SlotSortMode = 'slot' | 'points' | 'ppm';

// Each row holds up to two players, so there's no single "row value" to sort
// by -- we use whichever side's figure is higher. That surfaces the slots
// with the biggest scorer (or the most efficient starter) first, which is
// the point of letting the user re-sort at all. Rows with nothing to compare
// (both cells empty, or both null PPM) sink to the bottom rather than the top.
function rowMetric(row: SlotRow, mode: 'points' | 'ppm'): number {
  const values: number[] = [];
  for (const player of [row.left, row.right]) {
    if (!player) continue;
    const value = mode === 'points' ? player.points : player.ppm;
    if (value !== null) values.push(value);
  }
  // Not -Infinity: two empty rows would compare as (-Inf) - (-Inf) = NaN, and
  // a NaN comparator makes the sort's behaviour implementation-defined.
  if (values.length === 0) return Number.MIN_SAFE_INTEGER;
  return Math.max(...values);
}

export function sortSlotRows(rows: SlotRow[], mode: SlotSortMode): SlotRow[] {
  if (mode === 'slot') return rows;
  return [...rows].sort((a, b) => rowMetric(b, mode) - rowMetric(a, mode));
}

export interface EfficiencyHighlights {
  bestId: string | null;
  worstId: string | null;
}

// Best/worst PPM among starters, restricted to cap-eligible players (see
// isEfficiencyEligible) so a $0 or near-$0 flier can't win "most efficient"
// by default. Skips the highlight entirely with fewer than two eligible
// players -- a single eligible starter isn't a "best vs worst" comparison.
export function bestWorstEligibleStarters(players: MatchupPlayer[]): EfficiencyHighlights {
  const eligible = players.filter(
    (p) => p.is_starter && p.ppm !== null && isEfficiencyEligible(p.cap_value)
  );
  if (eligible.length < 2) return { bestId: null, worstId: null };

  let best = eligible[0];
  let worst = eligible[0];
  for (const player of eligible) {
    if ((player.ppm as number) > (best.ppm as number)) best = player;
    if ((player.ppm as number) < (worst.ppm as number)) worst = player;
  }
  // With every eligible starter on the same PPM, best and worst resolve to the
  // same player -- highlighting one row as both is worse than no highlight.
  if (best.player_id === worst.player_id) return { bestId: null, worstId: null };
  return { bestId: best.player_id, worstId: worst.player_id };
}
