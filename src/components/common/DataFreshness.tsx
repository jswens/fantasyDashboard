import { useEffect, useState } from 'react';
import type { DataStatus } from '@/pages/api/data-status';

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Fixed bottom-right badge showing when league data was last pulled from
// Sleeper. Turns amber when the last pull failed and the page is showing the
// previous good data, so a stale dashboard is never silently stale.
export default function DataFreshness() {
  const [status, setStatus] = useState<DataStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch('/api/data-status');
        if (!response.ok) return;
        const data: DataStatus = await response.json();
        if (!cancelled) setStatus(data);
      } catch (err) {
        // The badge is informational; a failure here shouldn't surface as an error.
        console.error('Error fetching data status:', err);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status?.lastUpdated) return null;

  return (
    <div
      title={
        status.stale
          ? "Couldn't reach Sleeper on this page load — showing the last data we successfully pulled."
          : 'League data is pulled from Sleeper each time the page loads.'
      }
      className={`fixed bottom-3 right-3 z-40 rounded-full border px-3 py-1.5 text-xs shadow-lg backdrop-blur ${
        status.stale
          ? 'bg-sleeper-panel/90 border-sleeper-yellow/40 text-sleeper-yellow'
          : 'bg-sleeper-panel/90 border-sleeper-border text-sleeper-muted'
      }`}
    >
      {status.stale ? 'Sleeper unreachable · data from ' : 'Data updated '}
      {formatTimestamp(status.lastUpdated)}
    </div>
  );
}
