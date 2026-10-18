import { useState, useEffect, useCallback, useMemo } from 'react';
import { User } from 'firebase/auth';
import { usePlayerMarks } from '@/lib/hooks/usePlayerMarks';
import PlayerMarkButtons from '@/components/player/PlayerMarkButtons';
import PlayerActionsMenu from '@/components/players/PlayerActionsMenu';
import { PlayerMarkType } from '@/lib/types/marks';

interface FreeAgent {
  player_id: string;
  full_name: string;
  position: string;
  team: string | null;
  cap_value: number;
  cap_value_formatted: string;
  projection?: number;
  tier?: number;
  tierPosition?: number;
  expertRank?: number;
  expertEcr?: number;
  expertVsEcr?: number;
}

type ImportFormat = 'projections' | 'expertRankings';

/** Cap ceilings worth one click; cap values in this league run ~$0.9M to ~$48M. */
const CAP_PRESETS = [
  { label: '$1M', value: 1_000_000 },
  { label: '$2.5M', value: 2_500_000 },
  { label: '$5M', value: 5_000_000 },
  { label: '$10M', value: 10_000_000 },
];

/**
 * Reads a typed cap ceiling, accepting "5m", "$5,000,000" or "900k". A bare
 * number is taken at face value — the parsed figure is echoed back under the
 * input so a mis-scaled entry is obvious rather than silently wrong.
 */
function parseCapInput(raw: string): number | null {
  const cleaned = raw.trim().toLowerCase().replace(/[$,\s]/g, '');
  if (!cleaned) return null;

  const match = cleaned.match(/^(\d+(?:\.\d+)?)(m|k)?$/);
  if (!match) return null;

  const amount = parseFloat(match[1]);
  if (!isFinite(amount) || amount <= 0) return null;

  const multiplier = match[2] === 'm' ? 1_000_000 : match[2] === 'k' ? 1_000 : 1;
  return Math.round(amount * multiplier);
}

interface FreeAgentsByPosition {
  [position: string]: FreeAgent[];
}

interface FreeAgentsDisplayProps {
  user: User;
  isAdmin: boolean;
  isCommissioner?: boolean;
}

export default function FreeAgentsDisplay({ user, isAdmin, isCommissioner = false }: FreeAgentsDisplayProps) {
  const canEdit = isAdmin || isCommissioner;
  const [freeAgents, setFreeAgents] = useState<FreeAgentsByPosition>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('QB');
  const [totalFreeAgents, setTotalFreeAgents] = useState(0);
  const [affordableFreeAgents, setAffordableFreeAgents] = useState(0);
  const [capInput, setCapInput] = useState('');
  const [maxCap, setMaxCap] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingProjections, setUploadingProjections] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadFormat, setUploadFormat] = useState<ImportFormat | null>(null);
  const [showTierInput, setShowTierInput] = useState(false);
  const [tierText, setTierText] = useState('');
  const [uploadingTiers, setUploadingTiers] = useState(false);
  const [tierMessage, setTierMessage] = useState('');
  const [markFilter, setMarkFilter] = useState<PlayerMarkType | 'all'>('all');

  const { getMark, setMark } = usePlayerMarks(user);

  const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'DL', 'LB', 'DB'];

  const getAuthHeader = useCallback(async () => {
    const idToken = await user.getIdToken();
    return { Authorization: `Bearer ${idToken}` };
  }, [user]);

  const fetchFreeAgents = useCallback(async () => {
    setRefreshing(true);
    try {
      const headers = await getAuthHeader();
      // The cap ceiling is applied server-side, before the per-position top 10,
      // so a tight budget still returns the best players it can afford.
      const query = maxCap === null ? '' : `?maxCap=${maxCap}`;
      const response = await fetch(`/api/free-agents${query}`, { headers });

      const data = await response.json();

      if (data.success) {
        setFreeAgents(data.data);
        setTotalFreeAgents(data.totalFreeAgents);
        setAffordableFreeAgents(data.affordableFreeAgents ?? data.totalFreeAgents);
        setError('');
      } else {
        setError(data.message || 'Failed to fetch free agents');
      }
    } catch (error) {
      console.error('Network error:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getAuthHeader, maxCap]);

  useEffect(() => {
    fetchFreeAgents();
  }, [fetchFreeAgents]);

  // Debounced so typing a ceiling does not fire a request per keystroke.
  useEffect(() => {
    const parsed = parseCapInput(capInput);
    const timer = setTimeout(() => setMaxCap(parsed), 400);
    return () => clearTimeout(timer);
  }, [capInput]);

  // One button for every supported CSV shape — the API detects which format
  // the file is (projections or expert rankings) and reports it back.
  const handleProjectionUpload = async (file: File) => {
    setUploadingProjections(true);
    setUploadMessage('');
    setUploadFormat(null);

    try {
      const headers = await getAuthHeader();
      const formData = new FormData();
      formData.append('projections', file);

      const response = await fetch('/api/upload-projections', {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setUploadMessage(data.message);
        setUploadFormat(data.format ?? null);
        setLoading(true);
        await fetchFreeAgents();
      } else {
        setUploadMessage(`Error: ${data.message}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadMessage('Upload failed. Please try again.');
    } finally {
      setUploadingProjections(false);
    }
  };

  const handleTierUpload = async () => {
    if (!tierText.trim()) return;

    setUploadingTiers(true);
    setTierMessage('');

    try {
      const headers = await getAuthHeader();
      const response = await fetch('/api/upload-tiers', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierText }),
      });

      const data = await response.json();

      if (data.success) {
        setTierMessage(data.message);
        setTierText('');
        setShowTierInput(false);
        setLoading(true);
        await fetchFreeAgents();
      } else {
        setTierMessage(`Error: ${data.message}`);
      }
    } catch (error) {
      console.error('Tier upload error:', error);
      setTierMessage('Tier upload failed. Please try again.');
    } finally {
      setUploadingTiers(false);
    }
  };

  // What actually decided the order of the list on screen. Derived from the
  // rows themselves so it survives a reload, unlike the upload messages.
  const sortBasis = useMemo<'tiers' | 'projections' | 'expertRankings' | 'cap'>(() => {
    const list = freeAgents[selectedPosition] || [];
    if (list.some((player) => player.tier !== undefined)) return 'tiers';
    if (list.some((player) => player.projection !== undefined)) return 'projections';
    if (list.some((player) => player.expertRank !== undefined)) return 'expertRankings';
    return 'cap';
  }, [freeAgents, selectedPosition]);

  // Whether a rankings file covers this position, which is what makes an
  // absent rank worth labelling as "Unranked" rather than leaving blank.
  const hasRankingsLoaded = useMemo(
    () => (freeAgents[selectedPosition] || []).some((player) => player.expertRank !== undefined),
    [freeAgents, selectedPosition]
  );

  const parsedCapInput = parseCapInput(capInput);

  const sortBasisLabel = {
    tiers: 'Ranked by tiers with salary cap values',
    projections: 'Ranked by projections with salary cap values',
    expertRankings: 'Ranked by imported expert rankings with salary cap values',
    cap: 'Ranked by salary cap value',
  }[sortBasis];

  const displayedFreeAgents = useMemo(() => {
    const list = freeAgents[selectedPosition] || [];
    if (markFilter === 'all') return list;
    return list.filter((player) => getMark(player.player_id) === markFilter);
  }, [freeAgents, selectedPosition, markFilter, getMark]);

  if (loading) {
    return (
      <div className="min-h-screen bg-sleeper-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-sleeper-border border-t-sleeper-teal"></div>
      </div>
    );
  }

  // Only take over the page when there is nothing to show. Changing the cap
  // filter refetches, and a failed refetch should not throw away a list the
  // user is already reading — that surfaces inline next to the filter instead.
  if (error && Object.keys(freeAgents).length === 0) {
    return (
      <div className="min-h-screen bg-sleeper-bg flex items-center justify-center">
        <div className="text-center">
          <div className="text-sleeper-red text-xl mb-4">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sleeper-bg">
      {/* Header */}
      <div className="bg-sleeper-panel border-b border-sleeper-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-sleeper-text">Top Free Agents</h1>
              <p className="text-sm text-sleeper-muted mt-1">
                {maxCap === null
                  ? `${totalFreeAgents.toLocaleString()} total free agents available`
                  : `${affordableFreeAgents.toLocaleString()} of ${totalFreeAgents.toLocaleString()} free agents within $${maxCap.toLocaleString('en-US')}`}
                {uploadMessage && uploadMessage.includes('Successfully') && (
                  <span className="ml-2 text-sleeper-teal font-medium">
                    • Sorted by {uploadFormat === 'expertRankings' ? 'expert rankings' : 'projections'}
                  </span>
                )}
                {tierMessage && tierMessage.includes('Successfully') && (
                  <span className="ml-2 text-sleeper-purple font-medium">• Sorted by tiers</span>
                )}
              </p>
            </div>
            {isAdmin && (
              <div className="flex space-x-3">
                {/* Upload Projections */}
                <label
                  title="Accepts projections (Player, Team, points) or expert rankings (Rank, Player Name, Team, Position, ECR)"
                  className="bg-sleeper-teal text-sleeper-bg px-4 py-2 rounded-full font-semibold hover:bg-sleeper-teal-dark flex items-center cursor-pointer transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  {uploadingProjections ? 'Uploading...' : 'Upload CSV'}
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleProjectionUpload(file);
                    }}
                    className="hidden"
                    disabled={uploadingProjections}
                  />
                </label>

                {/* Upload Tiers */}
                <button
                  onClick={() => setShowTierInput(!showTierInput)}
                  className="bg-sleeper-purple text-sleeper-bg px-4 py-2 rounded-full font-semibold hover:brightness-110 flex items-center transition-all"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Upload Tiers
                </button>
              </div>
            )}
          </div>

          {/* Upload Status Messages */}
          {uploadMessage && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
              <div className={`rounded-md p-4 border ${uploadMessage.startsWith('Error') ? 'bg-sleeper-red-muted text-sleeper-red border-sleeper-red/30' : 'bg-sleeper-teal-muted text-sleeper-teal border-sleeper-teal/30'}`}>
                <p className="text-sm">{uploadMessage}</p>
              </div>
            </div>
          )}

          {tierMessage && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
              <div className={`rounded-md p-4 border ${tierMessage.startsWith('Error') ? 'bg-sleeper-red-muted text-sleeper-red border-sleeper-red/30' : 'bg-sleeper-purple/10 text-sleeper-purple border-sleeper-purple/30'}`}>
                <p className="text-sm">{tierMessage}</p>
              </div>
            </div>
          )}

          {/* Tier Input Modal */}
          {showTierInput && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
              <div className="bg-sleeper-surface border border-sleeper-border rounded-xl p-6">
                <h3 className="text-lg font-medium text-sleeper-text mb-4">Upload Player Tiers</h3>
                <p className="text-sm text-sleeper-muted mb-4">
                  Paste tier data in this format: &quot;Tier 1: Player1, Player2&quot; (one tier per line)
                </p>
                <textarea
                  value={tierText}
                  onChange={(e) => setTierText(e.target.value)}
                  placeholder="Tier 1: Brandon Aubrey, Cameron Dicker&#10;Tier 2: Tyler Loop, Wil Lutz, Ka'imi Fairbairn&#10;..."
                  className="w-full h-32 px-3 py-2 bg-sleeper-bg border border-sleeper-border rounded-md text-sleeper-text placeholder-sleeper-faint focus:outline-none focus:ring-2 focus:ring-sleeper-teal focus:border-sleeper-teal"
                  disabled={uploadingTiers}
                />
                <div className="mt-4 flex justify-end space-x-3">
                  <button
                    onClick={() => { setShowTierInput(false); setTierText(''); }}
                    className="px-4 py-2 text-sm font-medium text-sleeper-muted bg-sleeper-surface-hover rounded-full hover:text-sleeper-text"
                    disabled={uploadingTiers}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleTierUpload}
                    disabled={uploadingTiers || !tierText.trim()}
                    className="px-4 py-2 text-sm font-semibold text-sleeper-bg bg-sleeper-purple rounded-full hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadingTiers ? 'Uploading...' : 'Upload Tiers'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Position Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <nav className="flex flex-wrap gap-2">
          {positions.map((position) => {
            const count = freeAgents[position]?.length || 0;
            const isActive = selectedPosition === position;
            return (
              <button
                key={position}
                onClick={() => setSelectedPosition(position)}
                className={`py-2 px-4 rounded-full font-semibold text-sm border transition-colors ${
                  isActive
                    ? 'bg-sleeper-teal text-sleeper-bg border-sleeper-teal'
                    : 'bg-transparent text-sleeper-muted border-sleeper-border hover:text-sleeper-text hover:border-sleeper-teal/50'
                }`}
              >
                {position}
                <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${isActive ? 'bg-sleeper-bg/20 text-sleeper-bg' : 'bg-sleeper-surface-hover text-sleeper-muted'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Mark Filter */}
        <div className="mt-4 flex items-center space-x-2">
          <span className="text-sm font-medium text-sleeper-muted">Filter by mark:</span>
          {(['all', 'sleeper', 'target', 'avoid'] as const).map((option) => (
            <button
              key={option}
              onClick={() => setMarkFilter(option)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                markFilter === option
                  ? option === 'sleeper'
                    ? 'bg-sleeper-purple text-sleeper-bg border-sleeper-purple'
                    : option === 'target'
                      ? 'bg-sleeper-teal text-sleeper-bg border-sleeper-teal'
                      : option === 'avoid'
                        ? 'bg-sleeper-red text-sleeper-bg border-sleeper-red'
                        : 'bg-sleeper-text text-sleeper-bg border-sleeper-text'
                  : 'bg-transparent text-sleeper-muted border-sleeper-border hover:text-sleeper-text hover:border-sleeper-teal/50'
              }`}
            >
              {option === 'all' ? 'All' : option.charAt(0).toUpperCase() + option.slice(1)}
            </button>
          ))}
        </div>

        {/* Cap Filter */}
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-sleeper-muted">Cap to spend:</span>
            {CAP_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => { setCapInput(preset.label.replace('$', '')); setMaxCap(preset.value); }}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                  maxCap === preset.value
                    ? 'bg-sleeper-teal text-sleeper-bg border-sleeper-teal'
                    : 'bg-transparent text-sleeper-muted border-sleeper-border hover:text-sleeper-text hover:border-sleeper-teal/50'
                }`}
              >
                {preset.label}
              </button>
            ))}
            <button
              onClick={() => { setCapInput(''); setMaxCap(null); }}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                maxCap === null
                  ? 'bg-sleeper-text text-sleeper-bg border-sleeper-text'
                  : 'bg-transparent text-sleeper-muted border-sleeper-border hover:text-sleeper-text hover:border-sleeper-teal/50'
              }`}
            >
              Any
            </button>
            <input
              type="text"
              value={capInput}
              onChange={(e) => setCapInput(e.target.value)}
              placeholder="e.g. 5m"
              aria-label="Maximum cap value to spend"
              className="w-28 px-3 py-1 text-xs bg-sleeper-bg border border-sleeper-border rounded-full text-sleeper-text placeholder-sleeper-faint focus:outline-none focus:ring-2 focus:ring-sleeper-teal focus:border-sleeper-teal"
            />
            {refreshing && <span className="text-xs text-sleeper-faint">Updating…</span>}
            {error && !refreshing && <span className="text-xs text-sleeper-red">{error}</span>}
          </div>
          {capInput.trim() && (
            <p className="mt-2 text-xs text-sleeper-faint">
              {parsedCapInput === null ? (
                <span className="text-sleeper-red">
                  Couldn&apos;t read that amount — try 5m, 900k or 5000000
                </span>
              ) : (
                <>
                  At or below ${parsedCapInput.toLocaleString('en-US')} •{' '}
                  {affordableFreeAgents.toLocaleString()} of {totalFreeAgents.toLocaleString()} free agents fit
                </>
              )}
            </p>
          )}
        </div>

        {/* Free Agents Table */}
        <div className="mt-6">
          <div className="bg-sleeper-surface border border-sleeper-border overflow-hidden rounded-xl">
            <div className="px-4 py-5 sm:px-6 border-b border-sleeper-border">
              <h3 className="text-lg leading-6 font-medium text-sleeper-text">
                Top 10 {selectedPosition} Free Agents
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-sleeper-muted">
                {sortBasisLabel}
                {maxCap !== null && ` • capped at $${maxCap.toLocaleString('en-US')}`}
              </p>
            </div>
            <ul className="divide-y divide-sleeper-border">
              {displayedFreeAgents.length > 0 ? displayedFreeAgents.map((player, index) => (
                <li key={player.player_id}>
                  <div className="px-4 py-4 sm:px-6 hover:bg-sleeper-surface-hover transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-sleeper-teal-muted border border-sleeper-teal/30 flex items-center justify-center">
                            <span className="text-sm font-medium text-sleeper-teal">#{index + 1}</span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-sleeper-text">{player.full_name}</div>
                          <div className="text-sm text-sleeper-muted">
                            {player.team ? `${player.team} • ${player.position}` : player.position}
                          </div>
                        </div>
                        <div className="ml-4">
                          <PlayerMarkButtons
                            playerId={player.player_id}
                            currentMark={getMark(player.player_id)}
                            onChange={(mark) => setMark(player.player_id, mark)}
                          />
                        </div>
                        {canEdit && (
                          <div className="ml-2">
                            <PlayerActionsMenu playerId={player.player_id} />
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        {player.tier !== undefined ? (
                          <>
                            <div className="text-sm font-medium text-sleeper-purple">Tier {player.tier}</div>
                            <div className="text-sm font-medium text-sleeper-text">{player.cap_value_formatted}</div>
                          </>
                        ) : player.projection !== undefined ? (
                          <>
                            <div className="text-sm font-medium text-sleeper-teal">{player.projection.toFixed(1)} pts</div>
                            <div className="text-sm font-medium text-sleeper-text">{player.cap_value_formatted}</div>
                          </>
                        ) : (
                          <div className="text-sm font-medium text-sleeper-text">{player.cap_value_formatted}</div>
                        )}
                        {/* The rank comes from the imported rankings file, which
                            ranks rostered and free-agent players alike. Players
                            the file does not list simply have no rank. */}
                        {player.expertRank !== undefined ? (
                          <div className="text-sm text-sleeper-faint">
                            <span className="text-sleeper-purple font-medium">Rank #{player.expertRank}</span>
                            {player.expertEcr !== undefined && <> • ECR {player.expertEcr}</>}
                            {player.expertVsEcr !== undefined && player.expertVsEcr !== 0 && (
                              <>
                                {' • '}
                                <span className={player.expertVsEcr > 0 ? 'text-sleeper-teal' : 'text-sleeper-red'}>
                                  {player.expertVsEcr > 0 ? '+' : ''}{player.expertVsEcr} vs ECR
                                </span>
                              </>
                            )}
                          </div>
                        ) : hasRankingsLoaded ? (
                          <div className="text-sm text-sleeper-faint">Unranked</div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              )) : (
                <li className="px-4 py-8 text-center text-sleeper-muted">
                  {markFilter !== 'all'
                    ? `No ${markFilter}-marked free agents for ${selectedPosition}`
                    : maxCap === null
                      ? `No free agents available for ${selectedPosition}`
                      : `No ${selectedPosition} free agents at or below $${maxCap.toLocaleString('en-US')}`}
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div className="bg-sleeper-surface border border-sleeper-border overflow-hidden rounded-xl">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-sleeper-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.916-.75M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.916-.75M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-sleeper-muted truncate">Total Free Agents</dt>
                    <dd className="text-lg font-medium text-sleeper-text">{totalFreeAgents.toLocaleString()}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-sleeper-surface border border-sleeper-border overflow-hidden rounded-xl">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-sleeper-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-sleeper-muted truncate">Positions Available</dt>
                    <dd className="text-lg font-medium text-sleeper-text">
                      {positions.filter(pos => (freeAgents[pos]?.length || 0) > 0).length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-sleeper-surface border border-sleeper-border overflow-hidden rounded-xl">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-sleeper-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-sleeper-muted truncate">Highest Cap Value</dt>
                    <dd className="text-lg font-medium text-sleeper-text">
                      {freeAgents[selectedPosition]?.[0]?.cap_value_formatted || 'N/A'}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
