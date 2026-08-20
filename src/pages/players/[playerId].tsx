import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import GoogleSignIn from '@/components/auth/GoogleSignIn';
import Header from '@/components/common/Header';
import Loading from '@/components/common/Loading';
import PlayerAvatar from '@/components/common/PlayerAvatar';
import { formatIntAsCurrency } from '@/lib/utils/formatters';
import type { PlayerDetail, PlayerEditableField, PlayerEditRequest } from '@/lib/types/playerEdit';

const FIELD_LABELS: Record<PlayerEditableField, string> = {
  first_name: 'First name',
  last_name: 'Last name',
  team: 'Team',
  cap_value: 'Cap hit',
};

function formatAuditValue(field: PlayerEditableField, value: string | number | null): string {
  if (value === null) return '—';
  if (field === 'cap_value') return formatIntAsCurrency(Number(value));
  return String(value);
}

export default function PlayerDetailPage() {
  const router = useRouter();
  const { playerId } = router.query;
  const { user, isAdmin, isCommissioner, loading: authLoading } = useAuth();
  const canEdit = isAdmin || isCommissioner;

  const [player, setPlayer] = useState<PlayerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [team, setTeam] = useState('');
  const [capValue, setCapValue] = useState('');

  const fetchPlayer = useCallback(async () => {
    if (!user || typeof playerId !== 'string') return;
    setLoading(true);
    setError('');
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/players/${playerId}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await response.json();
      if (data.success) {
        setPlayer(data.data);
        setFirstName(data.data.first_name);
        setLastName(data.data.last_name);
        setTeam(data.data.team || '');
        setCapValue(String(data.data.cap_value));
      } else {
        setError(data.message || 'Failed to load player');
      }
    } catch (err) {
      console.error('Error fetching player:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user, playerId]);

  useEffect(() => {
    fetchPlayer();
  }, [fetchPlayer]);

  const diff = useMemo(() => {
    if (!player) return {};
    const changes: PlayerEditRequest = {};
    if (firstName.trim() !== player.first_name) changes.first_name = firstName.trim();
    if (lastName.trim() !== player.last_name) changes.last_name = lastName.trim();
    const normalizedTeam = team.trim() ? team.trim().toUpperCase() : null;
    if (normalizedTeam !== (player.team || null)) changes.team = normalizedTeam;
    const parsedCap = parseInt(capValue.replace(/[$,]/g, ''), 10);
    if (!isNaN(parsedCap) && parsedCap !== player.cap_value) changes.cap_value = parsedCap;
    return changes;
  }, [player, firstName, lastName, team, capValue]);

  const hasChanges = Object.keys(diff).length > 0;

  const handleSave = async () => {
    if (!user || typeof playerId !== 'string' || !hasChanges) return;

    const parsedCap = parseInt(capValue.replace(/[$,]/g, ''), 10);
    if (isNaN(parsedCap) || parsedCap < 0) {
      setSaveMessage('Error: enter a valid non-negative cap number');
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setSaveMessage('Error: first and last name are required');
      return;
    }

    setSaving(true);
    setSaveMessage('');
    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/players/${playerId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(diff),
      });
      const data = await response.json();
      if (data.success) {
        setSaveMessage(data.message);
        setPlayer(data.data);
        setFirstName(data.data.first_name);
        setLastName(data.data.last_name);
        setTeam(data.data.team || '');
        setCapValue(String(data.data.cap_value));
      } else {
        setSaveMessage(`Error: ${data.message}`);
      }
    } catch (err) {
      console.error('Error saving player:', err);
      setSaveMessage('Error: failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return <Loading />;
  }

  if (!user) {
    return <GoogleSignIn user={null} />;
  }

  return (
    <>
      <Head>
        <title>{player ? `${player.first_name} ${player.last_name}` : 'Player'} - Fantasy League Dashboard</title>
      </Head>
      <Header title="Player" user={user} isCommissioner={isCommissioner} />

      <div className="min-h-screen bg-sleeper-bg">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <Link
              href="/players"
              className="inline-flex items-center text-sm font-medium text-sleeper-muted hover:text-sleeper-text transition-colors"
            >
              <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Players
            </Link>
          </div>

          {loading ? (
            <p className="text-sm text-sleeper-muted">Loading…</p>
          ) : error ? (
            <div className="rounded-md p-4 bg-sleeper-red-muted border border-sleeper-red/30 text-sleeper-red">
              <p className="text-sm">{error}</p>
            </div>
          ) : player ? (
            <>
              <div className="flex items-center space-x-4 mb-8">
                <PlayerAvatar playerId={player.player_id} fullName={`${player.first_name} ${player.last_name}`} size="lg" />
                <div className="min-w-0">
                  <h2 className="text-2xl font-bold text-sleeper-text truncate">
                    {player.first_name} {player.last_name}
                  </h2>
                  <p className="text-sm text-sleeper-muted truncate">
                    {player.position}
                    {player.team ? ` • ${player.team}` : ''}
                    {' • '}
                    {player.isRostered ? (
                      <span className="text-sleeper-purple">{player.rosterTeamName || 'Rostered'}</span>
                    ) : (
                      <span className="text-sleeper-teal">Free Agent</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="bg-sleeper-surface border border-sleeper-border rounded-xl p-6 mb-8">
                <h3 className="text-lg font-medium text-sleeper-text">Player Info</h3>
                <p className="text-sm text-sleeper-muted mt-1">
                  {canEdit
                    ? 'Edit this player\'s name, team, or cap hit. Every change is recorded in the audit history below.'
                    : 'Only commissioners and admins can edit player info.'}
                </p>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="First name" locked={player.edited_fields.includes('first_name')}>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      disabled={!canEdit || saving}
                      className="w-full px-3 py-2 bg-sleeper-bg border border-sleeper-border rounded-md text-sm text-sleeper-text focus:outline-none focus:ring-2 focus:ring-sleeper-teal focus:border-sleeper-teal disabled:opacity-60"
                    />
                  </Field>

                  <Field label="Last name" locked={player.edited_fields.includes('last_name')}>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      disabled={!canEdit || saving}
                      className="w-full px-3 py-2 bg-sleeper-bg border border-sleeper-border rounded-md text-sm text-sleeper-text focus:outline-none focus:ring-2 focus:ring-sleeper-teal focus:border-sleeper-teal disabled:opacity-60"
                    />
                  </Field>

                  <Field label="Team" locked={player.edited_fields.includes('team')}>
                    <input
                      type="text"
                      value={team}
                      onChange={(e) => setTeam(e.target.value)}
                      placeholder="e.g. DAL (blank = free agent)"
                      disabled={!canEdit || saving}
                      className="w-full px-3 py-2 bg-sleeper-bg border border-sleeper-border rounded-md text-sm text-sleeper-text placeholder-sleeper-faint focus:outline-none focus:ring-2 focus:ring-sleeper-teal focus:border-sleeper-teal disabled:opacity-60"
                    />
                  </Field>

                  <Field label="Cap hit ($)" locked={player.edited_fields.includes('cap_value')}>
                    <input
                      type="text"
                      value={capValue}
                      onChange={(e) => setCapValue(e.target.value)}
                      disabled={!canEdit || saving}
                      className="w-full px-3 py-2 bg-sleeper-bg border border-sleeper-border rounded-md text-sm text-sleeper-text focus:outline-none focus:ring-2 focus:ring-sleeper-teal focus:border-sleeper-teal disabled:opacity-60"
                    />
                  </Field>
                </div>

                {canEdit && (
                  <div className="mt-6 flex items-center gap-3">
                    <button
                      onClick={handleSave}
                      disabled={!hasChanges || saving}
                      className="px-4 py-2 text-sm font-semibold text-sleeper-bg bg-sleeper-teal rounded-full hover:bg-sleeper-teal-dark disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                    {!hasChanges && !saving && (
                      <span className="text-xs text-sleeper-faint">No changes to save</span>
                    )}
                  </div>
                )}

                {saveMessage && (
                  <div className={`rounded-md p-4 mt-4 border ${saveMessage.startsWith('Error') ? 'bg-sleeper-red-muted text-sleeper-red border-sleeper-red/30' : 'bg-sleeper-teal-muted text-sleeper-teal border-sleeper-teal/30'}`}>
                    <p className="text-sm">{saveMessage}</p>
                  </div>
                )}
              </div>

              <div className="bg-sleeper-surface border border-sleeper-border rounded-xl">
                <div className="px-6 py-4 border-b border-sleeper-border">
                  <h3 className="text-lg font-medium text-sleeper-text">Audit History</h3>
                  <p className="text-sm text-sleeper-muted">Every manual edit and cap import for this player, newest first.</p>
                </div>

                {player.audit_history.length === 0 ? (
                  <p className="px-6 py-8 text-center text-sm text-sleeper-muted">No edits recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-sleeper-border">
                      <thead className="bg-sleeper-panel">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-sleeper-muted uppercase tracking-wider">Field</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-sleeper-muted uppercase tracking-wider">Change</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-sleeper-muted uppercase tracking-wider">Source</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-sleeper-muted uppercase tracking-wider">Changed By</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-sleeper-muted uppercase tracking-wider">When</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-sleeper-border">
                        {[...player.audit_history].reverse().map((entry, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-sleeper-text">
                              {FIELD_LABELS[entry.field]}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-sleeper-muted">
                              {formatAuditValue(entry.field, entry.previousValue)} → {formatAuditValue(entry.field, entry.newValue)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${entry.source === 'season-import' ? 'bg-sleeper-teal-muted text-sleeper-teal' : 'bg-sleeper-purple/15 text-sleeper-purple'}`}>
                                {entry.source === 'season-import' ? 'Season import' : 'Manual edit'}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-sleeper-muted">{entry.email}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-sleeper-muted">
                              {typeof entry.changedAt === 'string' ? new Date(entry.changedAt).toLocaleString() : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}

function Field({ label, locked, children }: { label: string; locked: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-2 text-xs font-medium text-sleeper-muted uppercase tracking-wider mb-1">
        {label}
        {locked && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-sleeper-purple/15 text-sleeper-purple normal-case tracking-normal">
            Manually edited
          </span>
        )}
      </label>
      {children}
    </div>
  );
}
