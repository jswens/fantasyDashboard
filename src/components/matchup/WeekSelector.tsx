interface WeekSelectorProps {
  selectedWeek: number;
  currentWeek: number;
  lastRegularSeasonWeek: number;
  onSelect: (week: number) => void;
}

// Horizontal pill strip rather than a <select> -- with at most 18 weeks it's
// faster to scan and click than to open a dropdown, and it scrolls
// naturally on narrow screens instead of needing its own mobile variant.
export default function WeekSelector({
  selectedWeek,
  currentWeek,
  lastRegularSeasonWeek,
  onSelect,
}: WeekSelectorProps) {
  const weeks = Array.from({ length: lastRegularSeasonWeek }, (_, i) => i + 1);

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {weeks.map((week) => {
        const isSelected = week === selectedWeek;
        const isCurrent = week === currentWeek;
        return (
          <button
            key={week}
            type="button"
            onClick={() => onSelect(week)}
            title={isCurrent ? `Week ${week} (current)` : `Week ${week}`}
            className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
              isSelected
                ? 'border-sleeper-teal bg-sleeper-teal text-sleeper-bg'
                : 'border-sleeper-border bg-transparent text-sleeper-muted hover:border-sleeper-teal/50 hover:text-sleeper-text'
            }`}
          >
            {week}
            {isCurrent && (
              <span
                className={`ml-1 inline-block h-1.5 w-1.5 rounded-full ${
                  isSelected ? 'bg-sleeper-bg' : 'bg-sleeper-teal'
                }`}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
