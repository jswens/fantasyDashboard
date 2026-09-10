import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Header from '@/components/common/Header';
import Loading from '@/components/common/Loading';
import GoogleSignIn from '@/components/auth/GoogleSignIn';
import DataFreshness from '@/components/common/DataFreshness';
import { useAuth } from '@/lib/hooks/useAuth';
import type { WeekScoreboard } from '@/lib/types/matchup';
import { formatPoints } from '@/lib/utils/efficiency';
import WeekSelector from '@/components/matchup/WeekSelector';
import MatchupCard, { MatchupStatus } from '@/components/matchup/MatchupCard';
import StaleNotice from '@/components/matchup/StaleNotice';
import UnmatchedSides from '@/components/matchup/UnmatchedSides';

const AUTO_REFRESH_STORAGE_KEY = 'matchups:auto-refresh';
const AUTO_REFRESH_INTERVAL_MS = 60_000;

// Sleeper weeks run 1-18 (regular season + playoffs); anything outside that
// is a bad/garbled query param, not a real week to fetch.
function parseWeekParam(value: string | string[] | undefined): number | null {
  if (typeof value !== 'string') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 18) return null;
  return parsed;
}

export default function MatchupsPage() {
  const router = useRouter();
  const { user, isCommissioner, loading: authLoading } = useAuth();
  const [scoreboard, setScoreboard] = useState<WeekScoreboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const fetchInFlight = useRef(false);
  // Monotonic request id. A week change issued while a poll is still running
  // must not be dropped, but its response can arrive out of order -- so the
  // request is always made and only the newest response is allowed to land.
  const latestRequest = useRef(0);

  // null means "no ?week= override -- follow whatever week is current".
  const requestedWeek = router.isReady ? parseWeekParam(router.query.week) : null;

  // `skipIfInFlight` is for the 60s poll only: a tick that lands while a fetch
  // is already running is pointless and can be dropped. A user-initiated load
  // (mount, week change) must never be dropped -- doing so would leave the URL
  // on one week and the page showing another, with no sign anything was wrong.
  const fetchScoreboard = useCallback(async (week: number | null, skipIfInFlight = false) => {
    if (skipIfInFlight && fetchInFlight.current) return;
    const requestId = ++latestRequest.current;
    fetchInFlight.current = true;
    try {
      setError(null);
      const url = week === null ? '/api/matchups/current' : `/api/matchups/${week}`;
      const response = await fetch(url);
      const data = await response.json();
      if (requestId !== latestRequest.current) return; // superseded
      if (!response.ok) {
        throw new Error((data as { error?: string })?.error ?? 'Failed to load matchups');
      }
      setScoreboard(data as WeekScoreboard);
    } catch (err) {
      if (requestId !== latestRequest.current) return;
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      if (requestId === latestRequest.current) {
        setLoading(false);
        fetchInFlight.current = false;
      }
    }
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    setLoading(true);
    fetchScoreboard(requestedWeek);
  }, [router.isReady, requestedWeek, fetchScoreboard]);

  // Restore the persisted auto-refresh preference once the page mounts.
  // Off by default per spec -- localStorage absence (or a blocked store)
  // just means it stays off, which is already the initial state.
  useEffect(() => {
    try {
      setAutoRefresh(localStorage.getItem(AUTO_REFRESH_STORAGE_KEY) === 'true');
    } catch {
      // ignore -- private mode / disabled storage
    }
  }, []);

  const viewingCurrentWeek = scoreboard !== null && scoreboard.week === scoreboard.current_week;

  useEffect(() => {
    if (!autoRefresh || !viewingCurrentWeek) return;
    const interval = setInterval(() => {
      fetchScoreboard(requestedWeek, true);
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [autoRefresh, viewingCurrentWeek, requestedWeek, fetchScoreboard]);

  // Drives the "updated Xs ago" readout independent of the fetch cadence so it
  // keeps counting up even when auto-refresh is off. Only runs while that
  // readout is actually on screen -- re-rendering the whole scoreboard once a
  // second on a finished week is wasted work on the phone this is read on.
  useEffect(() => {
    if (!viewingCurrentWeek) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [viewingCurrentWeek]);

  const toggleAutoRefresh = () => {
    const next = !autoRefresh;
    setAutoRefresh(next);
    try {
      localStorage.setItem(AUTO_REFRESH_STORAGE_KEY, String(next));
    } catch {
      // best-effort persistence only
    }
  };

  const goToWeek = (week: number) => {
    if (!scoreboard) return;
    const query = week === scoreboard.current_week ? {} : { week: String(week) };
    router.push({ pathname: '/matchups', query }, undefined, { shallow: true });
  };

  if (authLoading || (loading && !scoreboard)) {
    return <Loading />;
  }

  if (!user) {
    return <GoogleSignIn user={null} />;
  }

  if (error && !scoreboard) {
    return (
      <div className="min-h-screen bg-sleeper-bg">
        <Header title="Matchups" user={user} isCommissioner={isCommissioner} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-sleeper-red-muted border border-sleeper-red/30 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-sleeper-red" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-sleeper-red">Error</h3>
                <div className="mt-2 text-sm text-sleeper-red/80">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!scoreboard) {
    return <Loading />;
  }

  const allSides = scoreboard.matchups.flatMap((m) => m.sides).concat(scoreboard.unmatched);
  const totalPoints = allSides.reduce((sum, side) => sum + side.points, 0);
  const highScore = allSides.reduce((max, side) => Math.max(max, side.points), 0);

  // The current week counts as "upcoming" until someone actually scores.
  // Sleeper publishes the pairings days before kickoff with every side on
  // zero, and rendering that as a live 0-0 game -- with a 0.00 pts/$1M
  // efficiency figure attached -- reads as a real (terrible) performance
  // rather than a week that hasn't started.
  const status: MatchupStatus =
    scoreboard.week > scoreboard.current_week
      ? 'upcoming'
      : scoreboard.is_final
        ? 'final'
        : totalPoints === 0
          ? 'upcoming'
          : 'live';

  // Closest game first when there's something to be close about; upcoming
  // weeks have no score to sort by, so matchup_id (Sleeper's own pairing
  // order) is the only stable ordering.
  const sortedMatchups = [...scoreboard.matchups].sort((a, b) =>
    status === 'upcoming' ? a.matchup_id - b.matchup_id : a.margin - b.margin
  );

  const secondsAgo = Math.max(0, Math.round((nowTick - new Date(scoreboard.fetched_at).getTime()) / 1000));

  return (
    <div className="min-h-screen bg-sleeper-bg">
      <Head>
        <title>Matchups - Fantasy League Dashboard</title>
        <meta name="description" content="Weekly fantasy matchup scoreboard" />
      </Head>

      <Header title="Matchups" user={user} isCommissioner={isCommissioner} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-sleeper-text">Week {scoreboard.week}</h2>
            <p className="text-sm text-sleeper-muted">
              {status === 'upcoming'
                ? 'Schedule preview -- games haven’t started yet.'
                : `${formatPoints(totalPoints)} points scored league-wide · high score ${formatPoints(highScore)}`}
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 sm:items-end">
            <label className="flex items-center gap-2 text-sm text-sleeper-muted">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={toggleAutoRefresh}
                disabled={!viewingCurrentWeek}
                className="h-4 w-4 rounded border-sleeper-border bg-sleeper-surface text-sleeper-teal focus:ring-sleeper-teal"
              />
              Auto-refresh (60s)
            </label>
            <span className="text-xs text-sleeper-faint">
              {viewingCurrentWeek
                ? `Updated ${secondsAgo}s ago`
                : status === 'upcoming'
                  ? 'Upcoming week — nothing to refresh yet'
                  : 'Completed week — no live updates'}
            </span>
          </div>
        </div>

        <div className="mb-6">
          <WeekSelector
            selectedWeek={scoreboard.week}
            currentWeek={scoreboard.current_week}
            lastRegularSeasonWeek={scoreboard.last_regular_season_week}
            onSelect={goToWeek}
          />
        </div>

        {scoreboard.stale && <StaleNotice />}

        {scoreboard.matchups.length === 0 ? (
          <div className="bg-sleeper-surface border border-sleeper-border rounded-xl p-6 text-center">
            <p className="text-sm text-sleeper-text">No matchups available for this week.</p>
            <p className="text-sm text-sleeper-muted mt-1">
              Sleeper couldn&apos;t be reached and there is no saved data to fall back on. Try
              reloading in a minute.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {sortedMatchups.map((matchup) => (
              <MatchupCard key={matchup.matchup_id} matchup={matchup} week={scoreboard.week} status={status} />
            ))}
          </div>
        )}

        <UnmatchedSides sides={scoreboard.unmatched} />
      </main>
      <DataFreshness />
    </div>
  );
}
