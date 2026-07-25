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
  isAdmin: boolean;
}

const CAP_SOURCE_LABELS: Record<PlayerSearchResult['capSource'], string> = {
  override: 'Admin override',
  import: 'Season import',
  'legacy-csv': 'Legacy CSV',
  none: 'No data',
};

const CAP_SOURCE_STYLES: Record<PlayerSearchResult['capSource'], string> = {
  override: 'bg-purple-100 text-purple-800',
  import: 'bg-green-100 text-green-800',
  'legacy-csv': 'bg-gray-100 text-gray-700',
  none: 'bg-red-100 text-red-700',
};

export default function PlayerSearch({ user, isAdmin }: PlayerSearchProps) {
  const [query, setQuery] = useState('');
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

  const runSearch = useCallback(async (q: string) => {
    setLoading(true);
    setError('');
    try {
      const headers = await getAuthHeader();
      const response = await fetch(`/api/players/search?q=${encodeURIComponent(q)}`, { headers });
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
  }, [getAuthHeader]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

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
        await runSearch(query);
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
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Player Cap Search</h1>
          <p className="text-sm text-gray-600 mt-1">
            Search all players and verify effective salary cap numbers (override &gt; season import &gt; legacy CSV).
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by player name..."
            className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {error && (
          <div className="rounded-md p-4 mb-4 bg-red-50 text-red-800">
            <p className="text-sm">{error}</p>
          </div>
        )}

        {saveMessage && (
          <div className={`rounded-md p-4 mb-4 ${saveMessage.startsWith('Error') ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
            <p className="text-sm">{saveMessage}</p>
          </div>
        )}

        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6 flex items-center justify-between">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              {query ? `Results for "${query}"` : 'All players'}
            </h3>
            <span className="text-sm text-gray-500">
              {loading ? 'Searching…' : `${total} player${total === 1 ? '' : 's'}`}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team / Pos</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cap Hit</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                  {isAdmin && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {results.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} className="px-4 py-8 text-center text-gray-500">
                      No players found
                    </td>
                  </tr>
                ) : (
                  results.map(player => (
                    <tr key={player.playerId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {player.fullName}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {player.team ? `${player.team} • ${player.position}` : player.position}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {player.isRostered ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {player.rosterTeamName || 'Rostered'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Free Agent
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {editingPlayerId === player.playerId ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-28 px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
                      {isAdmin && (
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {editingPlayerId === player.playerId ? (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => submitOverride(player.playerId)}
                                disabled={savingPlayerId === player.playerId}
                                className="px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                              >
                                {savingPlayerId === player.playerId ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                onClick={cancelEdit}
                                disabled={savingPlayerId === player.playerId}
                                className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEdit(player)}
                              className="px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800"
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
