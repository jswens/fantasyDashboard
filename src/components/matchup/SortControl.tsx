import { SlotSortMode } from './slots';

interface SortControlProps {
  value: SlotSortMode;
  onChange: (mode: SlotSortMode) => void;
}

const OPTIONS: { value: SlotSortMode; label: string }[] = [
  { value: 'slot', label: 'Slot' },
  { value: 'points', label: 'Points' },
  { value: 'ppm', label: 'PPM' },
];

// Small segmented control for re-ordering the starter rows. Default is
// 'slot' (the roster order both sides share) -- 'points' and 'ppm' reorder
// rows to surface the biggest scorers or most efficient slots first, see
// slots.ts#sortSlotRows for how a two-player row picks one sort value.
export default function SortControl({ value, onChange }: SortControlProps) {
  return (
    <div className="inline-flex rounded-full border border-sleeper-border p-0.5 text-xs font-semibold">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-full px-3 py-1 transition-colors ${
            value === opt.value
              ? 'bg-sleeper-teal text-sleeper-bg'
              : 'text-sleeper-muted hover:text-sleeper-text'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
