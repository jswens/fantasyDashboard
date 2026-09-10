// Amber "we're showing stale data" banner, matching the tone of
// DataFreshness's stale state (src/components/common/DataFreshness.tsx) but
// inline in the page flow rather than a fixed corner badge -- on the
// scoreboard the staleness applies to every card on the page, so it earns a
// more prominent spot.
export default function StaleNotice() {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-lg border border-sleeper-yellow/40 bg-sleeper-yellow/10 px-4 py-3">
      <svg className="h-5 w-5 flex-shrink-0 text-sleeper-yellow" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
      <div className="text-sm">
        <p className="font-medium text-sleeper-yellow">Sleeper couldn&apos;t be reached</p>
        <p className="text-sleeper-yellow/80">
          Showing the last data we successfully pulled for this week, not a live read.
        </p>
      </div>
    </div>
  );
}
