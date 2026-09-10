import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Header from '@/components/common/Header';
import Loading from '@/components/common/Loading';
import GoogleSignIn from '@/components/auth/GoogleSignIn';
import DataFreshness from '@/components/common/DataFreshness';
import { useAuth } from '@/lib/hooks/useAuth';
import type { WeekMatchup, WeekScoreboard } from '@/lib/types/matchup';
import SideSummaryHeader from '@/components/matchup/SideSummaryHeader';
import SlotRowView from '@/components/matchup/SlotRowView';
import SortControl from '@/components/matchup/SortControl';
import BenchList from '@/components/matchup/BenchList';
import StaleNotice from '@/components/matchup/StaleNotice';
import {
  bestWorstEligibleStarters,
  buildSlotRows,
  highlightFor,
  SlotSortMode,
  sortSlotRows,
} from '@/components/matchup/slots';

// router.query values are string | string[] | undefined depending on how
// Next parses the route -- collapse to a single string up front.
function toSingle(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function MatchupDetailPage() {
  const router = useRouter();
  const { user, isCommissioner, loading: authLoading } = useAuth();
  const [scoreboard, setScoreboard] = useState<WeekScoreboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SlotSortMode>('slot');

  const weekParam = toSingle(router.query.week);
  const matchupIdParam = toSingle(router.query.matchupId);
  const weekNum = weekParam !== undefined ? Number(weekParam) : NaN;
  const matchupIdNum = matchupIdParam !== undefined ? Number(matchupIdParam) : NaN;
  const validRoute = Number.isInteger(weekNum) && weekNum >= 1 && weekNum <= 18 && Number.isInteger(matchupIdNum);

  const fetchScoreboard = useCallback(async () => {
    if (!validRoute) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/matchups/${weekNum}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error((data as { error?: string })?.error ?? 'Failed to load matchup');
      }
      setScoreboard(data as WeekScoreboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [weekNum, validRoute]);

  useEffect(() => {
    if (!router.isReady) return;
    fetchScoreboard();
  }, [router.isReady, fetchScoreboard]);

  const matchup: WeekMatchup | undefined = scoreboard?.matchups.find((m) => m.matchup_id === matchupIdNum);

  const slotRows = useMemo(() => {
    if (!matchup) return [];
    // Slot labels come from the scoreboard (the league's own roster_positions)
    // rather than a constant, so the lineup can't drift from league settings.
    return sortSlotRows(
      buildSlotRows(scoreboard?.starting_slots ?? [], matchup.sides[0], matchup.sides[1]),
      sortMode
    );
  }, [matchup, scoreboard, sortMode]);

  const leftHighlights = useMemo(
    () => (matchup ? bestWorstEligibleStarters(matchup.sides[0].players) : { bestId: null, worstId: null }),
    [matchup]
  );
  const rightHighlights = useMemo(
    () => (matchup ? bestWorstEligibleStarters(matchup.sides[1].players) : { bestId: null, worstId: null }),
    [matchup]
  );

  if (authLoading || (loading && !scoreboard)) {
    return <Loading />;
  }

  if (!user) {
    return <GoogleSignIn user={null} />;
  }

  const backHref = weekParam ? `/matchups?week=${weekParam}` : '/matchups';

  if (!validRoute || error || (!loading && !matchup)) {
    return (
      <div className="min-h-screen bg-sleeper-bg">
        <Header title="Matchups" user={user} isCommissioner={isCommissioner} />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-sleeper-surface border border-sleeper-border rounded-xl p-6 text-center">
            <h3 className="text-sm font-medium text-sleeper-text">Matchup not found</h3>
            <p className="mt-1 text-sm text-sleeper-muted">
              {error ?? `Week ${weekParam ?? '?'}, matchup ${matchupIdParam ?? '?'} doesn't exist.`}
            </p>
            <Link
              href={backHref}
              className="mt-4 inline-block rounded-full bg-sleeper-teal/20 px-4 py-2 text-sm font-medium text-sleeper-teal hover:bg-sleeper-teal/30 transition-colors"
            >
              ← Back to matchups
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!scoreboard || !matchup) {
    return <Loading />;
  }

  const [sideA, sideB] = matchup.sides;

  return (
    <div className="min-h-screen bg-sleeper-bg">
      <Head>
        <title>
          {sideA.team_name} vs {sideB.team_name} - Week {scoreboard.week}
        </title>
      </Head>

      <Header
        title="Matchups"
        subtitle={`Week ${scoreboard.week} · ${sideA.team_name} vs ${sideB.team_name}`}
        onRefresh={fetchScoreboard}
        user={user}
        isCommissioner={isCommissioner}
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link
            href={backHref}
            className="inline-flex items-center text-sm font-medium text-sleeper-muted hover:text-sleeper-text transition-colors"
          >
            <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Week {scoreboard.week}
          </Link>
        </div>

        {scoreboard.stale && <StaleNotice />}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-6">
          <SideSummaryHeader side={sideA} isLeader={matchup.leader_team_id === sideA.team_id} />
          <SideSummaryHeader side={sideB} isLeader={matchup.leader_team_id === sideB.team_id} />
        </div>

        <div className="rounded-xl border border-sleeper-border bg-sleeper-surface p-4 mb-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-sleeper-text">Starting lineups</h3>
            <SortControl value={sortMode} onChange={setSortMode} />
          </div>

          <div className="mb-2 hidden items-center gap-3 px-2 text-xs font-semibold text-sleeper-faint md:flex">
            <div className="flex-1">{sideA.team_name}</div>
            <div className="w-16 flex-shrink-0 text-center">Slot</div>
            <div className="flex-1">{sideB.team_name}</div>
          </div>

          {slotRows.map((row) => (
            <SlotRowView
              key={row.slotIndex}
              row={row}
              leftHighlight={highlightFor(row.left?.player_id, leftHighlights)}
              rightHighlight={highlightFor(row.right?.player_id, rightHighlights)}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <BenchList side={sideA} />
          <BenchList side={sideB} />
        </div>
      </main>
      <DataFreshness />
    </div>
  );
}
