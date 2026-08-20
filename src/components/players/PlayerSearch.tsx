import { useState, useEffect, useCallback, useRef } from 'react';
import { User } from 'firebase/auth';

interface PlayerSearchResult {
  playerId: string;
  fullName: string;
  team: string | null;
  position: string;
  capHit: number;
  capHitFormatted: string;
  capSource: 'override' | 'import' | 'legacy-csv' | 'none';
  isRostered: boolean;
  rosterTeamName?: string;
}

interface PlayerSearchProps {
  user: User;
  isCommissioner: boolean;
  /** When true, shows only rostered players with a $0 effective cap hit instead of a free-text search. */
  zeroCapOnly?: boolean;
}

const CAP_SOURCE_LABELS: Record<PlayerSearchResult['capSource'], string> = {
  override: 'Admin override',
  import: 'Season import',
  'legacy-csv': 'Legacy CSV',
  none: 'No data',
};

const CAP_SOURCE_STYLES: Record<PlayerSearchResult['capSource'], string> = {
  override: 'bg-sleeper-purple/15 text-sleeper-purple',
  import: 'bg-sleeper-teal-muted text-sleeper-teal',
  'legacy-csv': 'bg-sleeper-surface-hover text-sleeper-muted',
  none: 'bg-sleeper-red-muted text-sleeper-red',
};

const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'DL', 'LB', 'DB'];

type RosterStatusFilter = 'all' | 'free_agent' | 'rostered';
type SortBy = 'name' | 'capHit';
type SortDir = 'asc' | 'desc';

export default function PlayerSearch({ user, isCommissioner, zeroCapOnly = false }: PlayerSearchProps) {
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState('');
  const [rosterStatus, setRosterStatus] = useState<RosterStatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [excludeZeroCap, setExcludeZeroCap] = useState(true);
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingPlayerId, setSavingPlayerId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getAuthHeader = useCallback(async () => {
    const idToken = await user.getIdToken();
    return { Authorization: `Bearer ${idToken}` };
  }, [user]);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const headers = await getAuthHeader();
      let url: string;
      if (zeroCapOnly) {
        url = '/api/players/search?zeroCapOnly=true';
      } else {
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        if (position) params.set('position', position);
        if (rosterStatus !== 'all') params.set('rosterStatus', rosterStatus);
        params.set('sortBy', sortBy);
        params.set('sortDir', sortDir);
        if (!excludeZeroCap) params.set('excludeZeroCap', 'false');
        url = `/api/players/search?${params.toString()}`;
      }
      const response = await fetch(url, { headers });
      const data = await response.json();

      if (data.success) {
        setResults(data.data || []);
        setTotal(data.total || 0);
      } else {
        setError(data.message || 'Search failed');
      }
    } catch (err) {
      console.error('Player search error:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader, zeroCapOnly, query, position, rosterStatus, sortBy, sortDir, excludeZeroCap]);

  useEffect(() => {
    if (zeroCapOnly) {
      runSearch();
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch();
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [runSearch, zeroCapOnly]);

  const startEdit = (player: PlayerSearchResult) => {
    setEditingPlayerId(player.playerId);
    setEditValue(String(player.capHit));
    setSaveMessage('');
  };

  const cancelEdit = () => {
    setEditingPlayerId(null);
    setEditValue('');
  };

  const submitOverride = async (playerId: string) => {
    const capHit = parseInt(editValue.replace(/[$,]/g, ''), 10);
    if (isNaN(capHit) || capHit < 0) {
      setSaveMessage('Error: enter a valid non-negative cap number');
      return;
    }

    setSavingPlayerId(playerId);
    setSaveMessage('');
    try {
      const headers = await getAuthHeader();
      const response = await fetch('/api/admin/cap-override', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, capHit }),
      });
      const data = await response.json();

      if (data.success) {
        setSaveMessage(data.message);
        setEditingPlayerId(null);
        await runSearch();
      } else {
        setSaveMessage(`Error: ${data.message}`);
      }
    } catch (err) {
      console.error('Cap override error:', err);
      setSaveMessage('Error: failed to save override');
    } finally {
      setSavingPlayerId(null);
    }
  };

  return (
    <div className="min-h-screen bg-sleeper-bg">
      <div className="bg-sleeper-panel border-b border-sleeper-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-sleeper-text">
            {zeroCapOnly ? 'Zero Cap Hit Players' : 'Player Cap Search'}
          </h1>
          <p className="text-sm text-sleeper-muted mt-1">
            {zeroCapOnly
              ? 'Rostered players whose effective salary cap number is still $0. Set a cap number below to clear the warning.'
              : 'Search all players and verify effective salary cap numbers (override > season import > legacy CSV).'}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!zeroCapOnly && (
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-md">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sleeper-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search within filtered players..."
                className="w-full pl-9 pr-3 py-2 bg-sleeper-surface border border-sleeper-border rounded-full text-sleeper-text placeholder-sleeper-faint focus:outline-none focus:ring-2 focus:ring-sleeper-teal focus:border-sleeper-teal"
              />
            </div>

            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="px-3 py-2 bg-sleeper-surface border border-sleeper-border rounded-full text-sm text-sleeper-text focus:outline-none focus:ring-2 focus:ring-sleeper-teal focus:border-sleeper-teal"
            >
              <option value="">All Positions</option>
              {POSITIONS.map(pos => (
                <option key={pos} value={pos}>{pos}</option>
              ))}
            </select>

            <select
              value={rosterStatus}
              onChange={(e) => setRosterStatus(e.target.value as RosterStatusFilter)}
              className="px-3 py-2 bg-sleeper-surface border border-sleeper-border rounded-full text-sm text-sleeper-text focus:outline-none focus:ring-2 focus:ring-sleeper-teal focus:border-sleeper-teal"
            >
              <option value="all">All Players</option>
              <option value="free_agent">Free Agents Only</option>
              <option value="rostered">Rostered Only</option>
            </select>

            <select
              value={`${sortBy}:${sortDir}`}
              onChange={(e) => {
                const [nextSortBy, nextSortDir] = e.target.value.split(':') as [SortBy, SortDir];
                setSortBy(nextSortBy);
                setSortDir(nextSortDir);
              }}
              className="px-3 py-2 bg-sleeper-surface border border-sleeper-border rounded-full text-sm text-sleeper-text focus:outline-none focus:ring-2 focus:ring-sleeper-teal focus:border-sleeper-teal"
            >
              <option value="name:asc">Name (A-Z)</option>
              <option value="name:desc">Name (Z-A)</option>
              <option value="capHit:desc">Cap Hit (High-Low)</option>
              <option value="capHit:asc">Cap Hit (Low-High)</option>
            </select>

            <label className="flex items-center gap-2 px-3 py-2 text-sm text-sleeper-muted select-none cursor-pointer">
              <input
                type="checkbox"
                checked={excludeZeroCap}
                onChange={(e) => setExcludeZeroCap(e.target.checked)}
                className="rounded border-sleeper-border text-sleeper-teal focus:ring-sleeper-teal"
              />
              Hide $0 cap hit players
            </label>
          </div>
        )}

        {error && (
          <div className="rounded-md p-4 mb-4 bg-sleeper-red-muted border border-sleeper-red/30 text-sleeper-red">
            <p className="text-sm">{error}</p>
          </div>
        )}

        {saveMessage && (
          <div className={`rounded-md p-4 mb-4 border ${saveMessage.startsWith('Error') ? 'bg-sleeper-red-muted text-sleeper-red border-sleeper-red/30' : 'bg-sleeper-teal-muted text-sleeper-teal border-sleeper-teal/30'}`}>
            <p className="text-sm">{saveMessage}</p>
          </div>
        )}

        <div className="bg-sleeper-surface border border-sleeper-border overflow-hidden rounded-xl">
          <div className="px-4 py-5 sm:px-6 flex items-center justify-between border-b border-sleeper-border">
            <h3 className="text-lg leading-6 font-medium text-sleeper-text">
              {zeroCapOnly
                ? 'Zero cap hit'
                : query || position || rosterStatus !== 'all' || !excludeZeroCap
                ? `Results${query ? ` for "${query}"` : ''}`
                : 'All players'}
            </h3>
            <span className="text-sm text-sleeper-muted">
              {loading ? 'Loading…' : `${total} player${total === 1 ? '' : 's'}`}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-sleeper-border">
              <thead className="bg-sleeper-panel">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-sleeper-muted uppercase tracking-wider">Player</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-sleeper-muted uppercase tracking-wider">Team / Pos</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-sleeper-muted uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-sleeper-muted uppercase tracking-wider">Cap Hit</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-sleeper-muted uppercase tracking-wider">Source</th>
                  {isCommissioner && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-sleeper-muted uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-sleeper-border">
                {results.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={isCommissioner ? 6 : 5} className="px-4 py-8 text-center text-sleeper-muted">
                      {zeroCapOnly ? 'No zero cap hit players — everyone rostered has a cap number.' : 'No players found'}
                    </td>
                  </tr>
                ) : (
                  results.map(player => (
                    <tr key={player.playerId} className="hover:bg-sleeper-surface-hover transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-sleeper-text">
                        {player.fullName}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-sleeper-muted">
                        {player.team ? `${player.team} • ${player.position}` : player.position}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-sleeper-muted">
                        {player.isRostered ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sleeper-purple/15 text-sleeper-purple">
                            {player.rosterTeamName || 'Rostered'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sleeper-teal-muted text-sleeper-teal">
                            Free Agent
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-sleeper-text">
                        {editingPlayerId === player.playerId ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-28 px-2 py-1 bg-sleeper-bg border border-sleeper-border rounded-md text-sm text-sleeper-text focus:outline-none focus:ring-2 focus:ring-sleeper-teal focus:border-sleeper-teal"
                            disabled={savingPlayerId === player.playerId}
                          />
                        ) : (
                          player.capHitFormatted
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CAP_SOURCE_STYLES[player.capSource]}`}>
                          {CAP_SOURCE_LABELS[player.capSource]}
                        </span>
                      </td>
                      {isCommissioner && (
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {editingPlayerId === player.playerId ? (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => submitOverride(player.playerId)}
                                disabled={savingPlayerId === player.playerId}
                                className="px-2 py-1 text-xs font-semibold text-sleeper-bg bg-sleeper-teal rounded-full hover:bg-sleeper-teal-dark disabled:opacity-50"
                              >
                                {savingPlayerId === player.playerId ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                onClick={cancelEdit}
                                disabled={savingPlayerId === player.playerId}
                                className="px-2 py-1 text-xs font-medium text-sleeper-muted bg-sleeper-surface-hover rounded-full hover:text-sleeper-text"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEdit(player)}
                              className="px-2 py-1 text-xs font-medium text-sleeper-teal hover:text-sleeper-teal-dark"
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
