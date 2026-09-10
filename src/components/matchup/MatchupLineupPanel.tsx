import { useMemo } from 'react';
import Link from 'next/link';
import { WeekMatchup } from '@/lib/types/matchup';
import SlotRowView from './SlotRowView';
import BenchList from './BenchList';
import { bestWorstEligibleStarters, buildSlotRows, highlightFor } from './slots';

interface MatchupLineupPanelProps {
  matchup: WeekMatchup;
  startingSlots: string[];
  week: number;
}

// The lineup body shown inside an expanded scoreboard card: both sides'
// starters aligned slot-for-slot, then the benches.
//
// Deliberately not sortable. Slot order is what makes the two sides
// comparable at a glance, which is the reason to expand a card in the first
// place; re-sorting one side against the other only makes sense with the room
// and the controls the full drill-in page has, so this links there instead.
export default function MatchupLineupPanel({ matchup, startingSlots, week }: MatchupLineupPanelProps) {
  const [sideA, sideB] = matchup.sides;

  const slotRows = useMemo(
    () => buildSlotRows(startingSlots, sideA, sideB),
    [startingSlots, sideA, sideB]
  );
  const leftHighlights = useMemo(() => bestWorstEligibleStarters(sideA.players), [sideA.players]);
  const rightHighlights = useMemo(() => bestWorstEligibleStarters(sideB.players), [sideB.players]);

  return (
    <div className="mt-3 border-t border-sleeper-border pt-3">
      <div className="mb-2 hidden items-center gap-3 px-2 text-xs font-semibold text-sleeper-faint md:flex">
        <div className="flex-1 truncate">{sideA.team_name}</div>
        <div className="w-16 flex-shrink-0 text-center">Slot</div>
        <div className="flex-1 truncate">{sideB.team_name}</div>
      </div>

      {slotRows.map((row) => (
        <SlotRowView
          key={row.slotIndex}
          row={row}
          leftHighlight={highlightFor(row.left?.player_id, leftHighlights)}
          rightHighlight={highlightFor(row.right?.player_id, rightHighlights)}
        />
      ))}

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <BenchList side={sideA} />
        <BenchList side={sideB} />
      </div>

      <div className="mt-3 text-right">
        <Link
          href={`/matchups/${week}/${matchup.matchup_id}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-sleeper-teal hover:text-sleeper-teal/80"
        >
          Open full view
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
