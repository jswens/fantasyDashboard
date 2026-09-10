import { SlotRow } from './slots';
import PlayerSlotCell from './PlayerSlotCell';

interface SlotRowViewProps {
  row: SlotRow;
  leftHighlight: 'best' | 'worst' | null;
  rightHighlight: 'best' | 'worst' | null;
}

// Below md this collapses to the slot label on its own line above a tight
// 2-column grid (left player, right player) -- a 3-part flex row with a
// center slot label doesn't fit at 375px, but a labeled 2-col grid does.
// At md+ it's the side-by-side row: left cell | fixed-width slot label |
// right cell.
export default function SlotRowView({ row, leftHighlight, rightHighlight }: SlotRowViewProps) {
  return (
    <div className="border-b border-sleeper-border py-2 last:border-b-0">
      <div className="mb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-sleeper-faint md:hidden">
        {row.label}
      </div>
      <div className="grid grid-cols-2 gap-2 md:flex md:items-stretch md:gap-3">
        <PlayerSlotCell player={row.left} highlight={leftHighlight} />
        <div className="hidden flex-shrink-0 items-center justify-center text-xs font-semibold uppercase tracking-wide text-sleeper-faint md:flex md:w-16">
          {row.label}
        </div>
        <PlayerSlotCell player={row.right} highlight={rightHighlight} />
      </div>
    </div>
  );
}
