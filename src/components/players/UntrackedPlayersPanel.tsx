import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { User } from 'firebase/auth';
import type { UntrackedPlayerRow } from '@/pages/api/players/untracked';

interface UntrackedPlayersPanelProps {
  user: User;
  /** Called after a player is added so the search results can refresh. */
  onPlayerAdded?: () => void;
}

function parseCap(value: string): number | null | 'invalid' {
  const cleaned = value.replace(/[$,\s]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 'invalid';
}

// Commissioner tool: lists rostered players the dashboard isn't tracking and
// adds them (or any Sleeper player by ID) to the player data.
export default function UntrackedPlayersPanel({ user, onPlayerAdded }: UntrackedPlayersPanelProps) {
  const [rows, setRows] = useState<UntrackedPlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [capInputs, setCapInputs] = useState<Record<string, string>>({});
  const [addingId, setAddingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [manualId, setManualId] = useState('');
  const [manualCap, setManualCap] = useState('');

  const getAuthHeader = useCallback(async () => {
    const idToken = await user.getIdToken();
    return { Authorization: `Bearer ${idToken}` };
  }, [user]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const headers = await getAuthHeader();
      const response = await fetch('/api/players/untracked', { headers });
      const data = await response.json();
      if (data.success) {
        setRows(data.data || []);
      } else {
        setError(data.message || 'Failed to load untracked players');
      }
    } catch (err) {
      console.error('Error fetching untracked players:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const addPlayer = async (playerId: string, capText: string) => {
    const cap = parseCap(capText);
    if (cap === 'invalid') {
      setMessage('Error: cap hit must be a non-negative dollar amount');
      return false;
    }

    setAddingId(playerId);
    setMessage('');
    try {
      const headers = await getAuthHeader();
      const response = await fetch('/api/players/untracked', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, cap_value: cap }),
      });
      const data = await response.json();
      if (!data.success) {
        setMessage(`Error: ${data.message}`);
        return false;
      }
      setMessage(cap === null ? `${data.message} with a $0 cap hit — set it from the player page.` : data.message);
      await fetchRows();
      onPlayerAdded?.();
      return true;
    } catch (err) {
      console.error('Error adding player:', err);
      setMessage('Error: failed to add player');
      return false;
    } finally {
      setAddingId(null);
    }
  };

  const addManual = async () => {
    const id = manualId.trim();
    if (!id) {
      setMessage('Error: enter a Sleeper player ID');
      return;
    }
    if (await addPlayer(id, manualCap)) {
      setManualId('');
      setManualCap('');
    }
  };

  const inputClass = 'px-3 py-1.5 bg-sleeper-bg border border-sleeper-border rounded-md text-sm text-sleeper-text placeholder-sleeper-faint focus:outline-none focus:ring-2 focus:ring-sleeper-teal focus:border-sleeper-teal disabled:opacity-50';
  const buttonClass = 'px-3 py-1.5 text-sm font-semibold text-sleeper-bg bg-sleeper-teal rounded-full hover:bg-sleeper-teal-dark disabled:opacity-50';

  return (
    <div className={`mb-6 bg-sleeper-surface border rounded-xl ${rows.length > 0 ? 'border-sleeper-yellow/40' : 'border-sleeper-border'}`}>
      <div className="px-4 py-4 sm:px-6 border-b border-sleeper-border">
        <h3 className="text-lg font-medium text-sleeper-text">
          Untracked rostered players
          {rows.length > 0 && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sleeper-yellow/15 text-sleeper-yellow align-middle">
              {rows.length}
            </span>
          )}
        </h3>
        <p className="text-sm text-sleeper-muted mt-1">
          Players on a Sleeper roster who aren&apos;t in the dashboard&apos;s player data, so they&apos;re left off rosters and cap totals.
          Adding one pulls their name and team from Sleeper. Leave cap hit blank to set it later.
        </p>
      </div>

      <div className="px-4 py-4 sm:px-6">
        {loading ? (
          <p className="text-sm text-sleeper-muted">Loading…</p>
        ) : error ? (
          <div className="rounded-md p-3 bg-sleeper-red-muted border border-sleeper-red/30 text-sleeper-red">
            <p className="text-sm">{error}</p>
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-sleeper-muted">Every rostered player is tracked.</p>
        ) : (
          <ul className="divide-y divide-sleeper-border">
            {rows.map(p => (
              <li key={p.player_id} className="py-3 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-sleeper-text">
                    {p.full_name ?? `Sleeper player ${p.player_id}`}
                    <span className="ml-2 font-normal text-sleeper-muted">
                      {[p.position, p.nfl_team ?? 'FA'].filter(Boolean).join(' · ')}
                    </span>
                  </p>
                  <p className="text-xs text-sleeper-faint">
                    On{' '}
                    <Link href={`/teams/${p.fantasy_team_id}`} className="hover:text-sleeper-teal">
                      {p.fantasy_team_name}
                    </Link>
                    {' '}· Sleeper ID {p.player_id}
                  </p>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Cap hit ($)"
                  aria-label={`Cap hit for ${p.full_name ?? p.player_id}`}
                  value={capInputs[p.player_id] ?? ''}
                  onChange={(e) => setCapInputs(prev => ({ ...prev, [p.player_id]: e.target.value }))}
                  disabled={addingId !== null}
                  className={`w-36 ${inputClass}`}
                />
                <button
                  onClick={() => addPlayer(p.player_id, capInputs[p.player_id] ?? '')}
                  disabled={addingId !== null}
                  className={buttonClass}
                >
                  {addingId === p.player_id ? 'Adding…' : 'Add player'}
                </button>
              </li>
            ))}
          </ul>
        )}

        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-sleeper-muted hover:text-sleeper-text select-none">
            Add a player by Sleeper ID
          </summary>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Sleeper player ID"
              aria-label="Sleeper player ID"
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              disabled={addingId !== null}
              className={`w-44 ${inputClass}`}
            />
            <input
              type="text"
              inputMode="numeric"
              placeholder="Cap hit ($)"
              aria-label="Cap hit"
              value={manualCap}
              onChange={(e) => setManualCap(e.target.value)}
              disabled={addingId !== null}
              className={`w-36 ${inputClass}`}
            />
            <button onClick={addManual} disabled={addingId !== null} className={buttonClass}>
              {addingId !== null && addingId === manualId.trim() ? 'Adding…' : 'Add player'}
            </button>
          </div>
        </details>

        {message && (
          <div className={`rounded-md p-3 mt-4 border ${message.startsWith('Error') ? 'bg-sleeper-red-muted text-sleeper-red border-sleeper-red/30' : 'bg-sleeper-teal-muted text-sleeper-teal border-sleeper-teal/30'}`}>
            <p className="text-sm">{message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
