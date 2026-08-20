import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { User } from 'firebase/auth';
import { useAuth } from '@/lib/hooks/useAuth';
import GoogleSignIn from '@/components/auth/GoogleSignIn';
import Header from '@/components/common/Header';
import Loading from '@/components/common/Loading';
import { formatIntAsCurrency } from '@/lib/utils/formatters';
import type { LeagueCapInfo } from '@/lib/types/cap';
import type { CommissionerEntry } from '@/lib/types/roles';

export default function CommissionerPage() {
  const { user, isAdmin, isCommissioner, loading: authLoading } = useAuth();

  if (authLoading) {
    return <Loading />;
  }

  if (!user) {
    return <GoogleSignIn user={null} />;
  }

  if (!isAdmin && !isCommissioner) {
    return (
      <>
        <Head>
          <title>Commissioner - Fantasy League Dashboard</title>
        </Head>
        <Header title="Commissioner" user={user} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="rounded-md p-4 bg-sleeper-red-muted border border-sleeper-red/30 text-sleeper-red">
            <p className="text-sm">Commissioner or admin access required.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Commissioner - Fantasy League Dashboard</title>
      </Head>
      <Header title="Commissioner" user={user} isCommissioner={isCommissioner} />

      <div className="min-h-screen bg-sleeper-bg">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {isCommissioner && <SalaryCapSection user={user} />}
          {isAdmin && <RefreshDataSection user={user} />}
          {isAdmin && <ManageCommissionersSection user={user} />}
        </div>
      </div>
    </>
  );
}

function SalaryCapSection({ user }: { user: User }) {
  const [capInfo, setCapInfo] = useState<LeagueCapInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const fetchCap = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/league-cap', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await response.json();
      if (data.success) {
        setCapInfo(data.data);
        setEditValue(String(data.data.salaryCap));
      } else {
        setError(data.message || 'Failed to load salary cap');
      }
    } catch (err) {
      console.error('Error fetching league cap:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCap();
  }, [fetchCap]);

  const submitCap = async () => {
    if (!capInfo) return;
    const salaryCap = parseInt(editValue.replace(/[$,]/g, ''), 10);
    if (isNaN(salaryCap) || salaryCap <= 0) {
      setMessage('Error: enter a valid positive cap number');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/admin/league-cap', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ season: capInfo.season, salaryCap }),
      });
      const data = await response.json();

      if (data.success) {
        setMessage(data.message);
        setCapInfo(data.data);
      } else {
        setMessage(`Error: ${data.message}`);
      }
    } catch (err) {
      console.error('Error setting league cap:', err);
      setMessage('Error: failed to save salary cap');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-sleeper-surface border border-sleeper-border rounded-xl p-6">
      <h2 className="text-lg font-medium text-sleeper-text">League Salary Cap</h2>
      <p className="text-sm text-sleeper-muted mt-1">
        Sets the cap every team is measured against on the dashboard and team pages.
      </p>

      {loading ? (
        <p className="text-sm text-sleeper-muted mt-6">Loading…</p>
      ) : error ? (
        <div className="rounded-md p-4 mt-6 bg-sleeper-red-muted border border-sleeper-red/30 text-sleeper-red">
          <p className="text-sm">{error}</p>
        </div>
      ) : capInfo ? (
        <>
          <div className="mt-6 flex items-center gap-3 text-sm text-sleeper-muted">
            <span>Season {capInfo.season}</span>
            {capInfo.isDefault && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sleeper-surface-hover text-sleeper-muted">
                Built-in default — not yet set for this season
              </span>
            )}
          </div>

          <p className="text-3xl font-bold text-sleeper-text mt-2">
            {formatIntAsCurrency(capInfo.salaryCap)}
          </p>

          <div className="mt-6 flex items-end gap-3">
            <div>
              <label htmlFor="salaryCap" className="block text-xs font-medium text-sleeper-muted uppercase tracking-wider mb-1">
                New cap ($)
              </label>
              <input
                id="salaryCap"
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                disabled={saving}
                className="w-48 px-3 py-2 bg-sleeper-bg border border-sleeper-border rounded-md text-sm text-sleeper-text focus:outline-none focus:ring-2 focus:ring-sleeper-teal focus:border-sleeper-teal disabled:opacity-50"
              />
            </div>
            <button
              onClick={submitCap}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-sleeper-bg bg-sleeper-teal rounded-full hover:bg-sleeper-teal-dark disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>

          {message && (
            <div className={`rounded-md p-4 mt-4 border ${message.startsWith('Error') ? 'bg-sleeper-red-muted text-sleeper-red border-sleeper-red/30' : 'bg-sleeper-teal-muted text-sleeper-teal border-sleeper-teal/30'}`}>
              <p className="text-sm">{message}</p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function RefreshDataSection({ user }: { user: User }) {
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');

  const refreshData = async () => {
    setRefreshing(true);
    setMessage('');
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/refresh', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ force: true }),
      });
      const data = await response.json();

      if (response.ok) {
        setMessage(data.message || 'Data refreshed successfully');
      } else {
        setMessage(`Error: ${data.error || 'Refresh failed'}`);
      }
    } catch (err) {
      console.error('Error refreshing data:', err);
      setMessage('Error: failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="bg-sleeper-surface border border-sleeper-border rounded-xl p-6">
      <h2 className="text-lg font-medium text-sleeper-text">Refresh Data</h2>
      <p className="text-sm text-sleeper-muted mt-1">
        Re-pulls player and roster data from Sleeper and rebuilds the team cache.
      </p>

      <button
        onClick={refreshData}
        disabled={refreshing}
        className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-full text-sleeper-bg bg-sleeper-teal hover:bg-sleeper-teal-dark disabled:opacity-50"
      >
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        {refreshing ? 'Refreshing…' : 'Refresh Data'}
      </button>

      {message && (
        <div className={`rounded-md p-4 mt-4 border ${message.startsWith('Error') ? 'bg-sleeper-red-muted text-sleeper-red border-sleeper-red/30' : 'bg-sleeper-teal-muted text-sleeper-teal border-sleeper-teal/30'}`}>
          <p className="text-sm">{message}</p>
        </div>
      )}
    </div>
  );
}

function ManageCommissionersSection({ user }: { user: User }) {
  const [commissioners, setCommissioners] = useState<CommissionerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [removingUid, setRemovingUid] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const getAuthHeader = useCallback(async () => {
    const idToken = await user.getIdToken();
    return { Authorization: `Bearer ${idToken}` };
  }, [user]);

  const fetchCommissioners = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const headers = await getAuthHeader();
      const response = await fetch('/api/admin/commissioners', { headers });
      const data = await response.json();
      if (data.success) {
        setCommissioners(data.data || []);
      } else {
        setError(data.message || 'Failed to load commissioners');
      }
    } catch (err) {
      console.error('Error fetching commissioners:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  useEffect(() => {
    fetchCommissioners();
  }, [fetchCommissioners]);

  const addCommissioner = async () => {
    const email = emailInput.trim();
    if (!email) {
      setMessage('Error: enter an email address');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const headers = await getAuthHeader();
      const response = await fetch('/api/admin/commissioners', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (data.success) {
        setMessage(data.message);
        setEmailInput('');
        await fetchCommissioners();
      } else {
        setMessage(`Error: ${data.message}`);
      }
    } catch (err) {
      console.error('Error adding commissioner:', err);
      setMessage('Error: failed to add commissioner');
    } finally {
      setSaving(false);
    }
  };

  const removeCommissioner = async (uid: string) => {
    setRemovingUid(uid);
    setMessage('');
    try {
      const headers = await getAuthHeader();
      const response = await fetch('/api/admin/commissioners', {
        method: 'DELETE',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid }),
      });
      const data = await response.json();

      if (data.success) {
        setMessage(data.message);
        await fetchCommissioners();
      } else {
        setMessage(`Error: ${data.message}`);
      }
    } catch (err) {
      console.error('Error removing commissioner:', err);
      setMessage('Error: failed to remove commissioner');
    } finally {
      setRemovingUid(null);
    }
  };

  return (
    <div className="bg-sleeper-surface border border-sleeper-border rounded-xl p-6">
      <h2 className="text-lg font-medium text-sleeper-text">Commissioners</h2>
      <p className="text-sm text-sleeper-muted mt-1">
        Commissioners can set the league salary cap and edit individual player info (name, team, cap hit). The person must have signed in at least once before they can be added.
      </p>

      <div className="mt-4 flex items-end gap-3">
        <div className="flex-1 max-w-sm">
          <label htmlFor="commissionerEmail" className="block text-xs font-medium text-sleeper-muted uppercase tracking-wider mb-1">
            Email
          </label>
          <input
            id="commissionerEmail"
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="name@example.com"
            disabled={saving}
            className="w-full px-3 py-2 bg-sleeper-bg border border-sleeper-border rounded-md text-sm text-sleeper-text placeholder-sleeper-faint focus:outline-none focus:ring-2 focus:ring-sleeper-teal focus:border-sleeper-teal disabled:opacity-50"
          />
        </div>
        <button
          onClick={addCommissioner}
          disabled={saving}
          className="px-4 py-2 text-sm font-semibold text-sleeper-bg bg-sleeper-teal rounded-full hover:bg-sleeper-teal-dark disabled:opacity-50"
        >
          {saving ? 'Adding…' : 'Add'}
        </button>
      </div>

      {message && (
        <div className={`rounded-md p-4 mt-4 border ${message.startsWith('Error') ? 'bg-sleeper-red-muted text-sleeper-red border-sleeper-red/30' : 'bg-sleeper-teal-muted text-sleeper-teal border-sleeper-teal/30'}`}>
          <p className="text-sm">{message}</p>
        </div>
      )}

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-sleeper-muted">Loading…</p>
        ) : error ? (
          <div className="rounded-md p-4 bg-sleeper-red-muted border border-sleeper-red/30 text-sleeper-red">
            <p className="text-sm">{error}</p>
          </div>
        ) : commissioners.length === 0 ? (
          <p className="text-sm text-sleeper-muted">No commissioners yet.</p>
        ) : (
          <ul className="divide-y divide-sleeper-border">
            {commissioners.map((c) => (
              <li key={c.uid} className="flex items-center justify-between py-2">
                <span className="text-sm text-sleeper-text">{c.email}</span>
                <button
                  onClick={() => removeCommissioner(c.uid)}
                  disabled={removingUid === c.uid}
                  className="px-2 py-1 text-xs font-medium text-sleeper-red hover:text-sleeper-red/80 disabled:opacity-50"
                >
                  {removingUid === c.uid ? 'Removing…' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
