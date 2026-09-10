# In-Season Features Plan

Plan for the 2026 in-season feature set: weekly matchup dashboard, per-player
points-per-dollar, gameday live scoring, a season-long points graph, and an
automated Tuesday weekly recap.

**Timing note:** as of 2026-09-09 the league is `in_season` at week 1 and the
season starts today. Phase 1 needs to land before Sunday 9/13 to be useful for
week 1. Phases 2-3 can land any time before the first recap.

---

## 0. What we already have

Confirmed against the live Sleeper API for league `1389239115878244352`:

| Fact | Value |
|---|---|
| League | Boom Tho, 2026, `in_season` |
| Teams | 12 (6 matchups/week) |
| Starting slots | QB, RB, RB, WR, WR, TE, SUPER_FLEX, IDP_FLEX, K, DL, DL, LB, LB, DB, DB (15) |
| Bench | 8 slots + 3 IR |
| Regular season | weeks 1-14 (`playoff_week_start: 15`, `playoff_teams: 6`) |
| Waivers | Tuesday (`waiver_day_of_week: 2`), FAAB 100 |
| Trade deadline | week 11 |

`GET /league/{id}/matchups/{week}` returns one entry per roster with
`matchup_id`, `roster_id`, `points`, `starters` (positional array),
`starters_points`, and `players_points` (every player, keyed by player_id).
That is everything needed to join against `Team.roster[].cap_value` — no new
data source required.

`GET /state/nfl` gives `{ week, season, season_type }`, which we need to know
what "this week" is and when a week has rolled over.

---

## 1. Points per dollar: define the metric first

Cap values are in raw dollars (~$201M cap, individual players in the tens of
millions), so literal "points per dollar" is a number like `0.00000047`. Use:

- **Primary: PPM — points per $1M of cap.** Josh Allen at $55M scoring 27.3 =
  `0.50 PPM`. Readable, sortable, fits in a table cell.
- **Secondary: cost per point.** `$2.01M / pt`. More intuitive for "was he
  worth it?" framing. Show on hover or as a second column.

```ts
const ppm = capValue > 0 ? points / (capValue / 1_000_000) : null;
```

### Zero-cap players are a real trap here

The app already tracks these (`has_zero_cap_warning`, `ZeroCapWarning`,
`/players/zero-cap`). A $0 cap player divides by zero and would otherwise
show as infinitely efficient and win every efficiency award forever.

Rules:
- `ppm` is `null` when `cap_value === 0`. Render as `—` with the existing
  `ZeroCapWarning` badge, never as `∞` or `0`.
- Efficiency **leaderboards and awards** require `cap_value >= $1,000,000`.
  Without a floor, a $500k flier scoring 12 points wins every week and the
  award stops being interesting.
- Team-level `active_cap` still counts $0 players (their cap really is $0),
  so team PPM is unaffected.

---

## 2. Phase 1 — Weekly matchup dashboard + drill-in

### 2.1 New service: `src/lib/services/matchups.ts`

Follows the shape of `fantasy-data.ts`: returns cached data on failure rather
than an empty scoreboard, coalesces concurrent refreshes at module scope.

```ts
export interface MatchupPlayer {
  player_id: string;
  full_name: string;
  position: string;          // the player's position
  slot: string | null;       // roster slot filled: 'QB' | 'SUPER_FLEX' | ... ; null = bench
  is_starter: boolean;
  cap_value: number;
  points: number;
  ppm: number | null;        // null when cap_value === 0
}

export interface MatchupSide {
  team_id: string;           // roster_id.toString() -- matches Team.team_id
  team_name: string;
  owner_name: string;
  avatar_url: string | null;
  points: number;
  bench_points: number;
  active_cap: number;        // sum of cap_value over STARTERS only
  roster_cap: number;        // whole roster, for reference
  ppm: number | null;        // points / (active_cap / 1M)
  players: MatchupPlayer[];
}

export interface WeekMatchup {
  matchup_id: number;
  sides: [MatchupSide, MatchupSide];
  margin: number;
}

export interface WeekScoreboard {
  season: string;
  week: number;
  matchups: WeekMatchup[];
  fetchedAt: string;
  isFinal: boolean;          // week has rolled over per /state/nfl
  stale: boolean;            // Sleeper unreachable, serving cache
}
```

### 2.2 Slot mapping

`starters` is a positional array aligned to the non-bench roster positions:

```ts
const slots = league.roster_positions.filter(p => p !== 'BN');
// starters[i] fills slots[i]; starters_points[i] is that slot's score
```

Two gotchas:
- An empty starting slot comes back as the string `"0"`, not `null`. Skip it
  but keep the slot in the UI so the lineup renders with a visible hole.
- `players_points` is the source of truth per player (it covers bench too). Use
  `starters_points` only as a cross-check; if they disagree, trust
  `players_points` and log it.

### 2.3 Joining cap values

`getAllTeams()` already returns `Team.roster[]` with `cap_value` per player.
Build `Map<player_id, Player>` per team and join. A player in `players_points`
but not on the cached roster (mid-week waiver claim, cache lag) falls back to
`cap_value: 0` and gets flagged in the UI rather than silently dropped.

### 2.4 API routes

| Route | Returns |
|---|---|
| `GET /api/matchups/current` | `WeekScoreboard` for `state.week` |
| `GET /api/matchups/[week]` | `WeekScoreboard` for a specific week |

Both `Cache-Control: no-store`, matching `/api/teams`.

### 2.5 Pages

- **`/matchups`** — all 6 matchups on one screen. Card per matchup: both teams,
  live score, margin, active cap for each side, team PPM. Sort so the closest /
  highest-scoring games float up. Links into the drill-in.
- **`/matchups/[matchupId]`** — side-by-side lineups, 15 starting slots aligned
  row-for-row so you can compare slot vs. slot. Per player: slot, name, cap,
  points, PPM. Bench listed below, dimmed. Sortable by PPM. Highlight the best
  and worst PPM starter on each side.

Add `Matchups` to `NAV_LINKS` in `src/components/common/Header.tsx`.

---

## 3. Phase 1b — Gameday live updates

Sleeper's matchup scores update through the game window with a short delay,
which is fine for this.

**v1 (what you asked for): refresh-driven.**
- API routes are `no-store`, so a browser refresh always re-pulls.
- `matchups.ts` gets a **60-second coalescing window** (vs. 30s for teams) so a
  page load that fans out across routes hits Sleeper once. Same
  `isFresh(cachedAt)` pattern as `TeamCacheService`.

**v1.5 (cheap, worth doing): opt-in auto-refresh.**
- A toggle in the scoreboard header: "Auto-refresh (60s)". `setInterval` +
  re-fetch, off by default, remembered in `localStorage`.
- Animate score changes (brief highlight on a changed number) so you can see
  what moved without diffing by eye.
- Show "updated 14s ago" using the existing `DataFreshness` component.

**Do not** add websockets or SSE. The data changes every ~30-60s at best and a
poll against an already-cached endpoint costs nothing.

### Gameday-specific UI
- A compact mobile layout — gameday viewing happens on a phone, and the 15-slot
  side-by-side table will not fit. Collapse to a stacked per-slot comparison.
- "Yet to play" count per side (starters whose NFL game hasn't kicked off). This
  is the single most useful gameday number, and it's derivable from the player's
  NFL team plus the week's schedule.

---

## 4. Phase 2 — Sealed weeks + season points graph

### 4.1 Why weeks must be sealed

A completed week's numbers are **not** stable if you recompute them later:

1. **Rosters change Tuesday.** Waivers run `waiver_day_of_week: 2` — the same
   day the recap publishes. Recomputing week 3 in week 6 would join week 3's
   points against a roster that no longer contains those players.
2. **Cap values are editable.** Commissioners edit `cap_value` through
   `player-edit.ts`. A recomputed PPM would use today's cap, not the cap that
   was in force that week.
3. **Cost.** The season graph would otherwise refetch 14 weeks of matchups on
   every dashboard load.

So: when a week finalizes, write an immutable snapshot.

### 4.2 Firestore layout

```
cache/matchups_{season}_{week}   // live scoreboard cache, short TTL, disposable
weeks/{season}-{week}            // SEALED snapshot: scores, per-player points,
                                 //   cap values as of seal time, computed awards
recaps/{season}-{week}           // generated recap (facts + prose)
```

`weeks/{season}-{week}` is written once and never recomputed from live data.

### 4.3 Seal trigger

**v1 — lazy, no new infrastructure.** On any request for week N, if
`state.week > N` (same season) and no sealed doc exists, build and write it.
This matches the app's existing refresh-on-page-load model.

**Stat corrections.** Sleeper applies corrections into Tuesday/Wednesday. Since
the recap publishes Tuesday, mark a snapshot sealed within 48h of week rollover
as `provisional: true`, show a small "may adjust" note on the recap, and give
the commissioner a **"Re-seal week"** button that overwrites the snapshot and
regenerates the recap. Cheap insurance.

**Later — scheduled.** Firebase App Hosting + Cloud Scheduler hitting a
`POST /api/cron/seal-week` guarded by a shared secret. Needed only when you
want the recap to *push* (email / notification) rather than be pulled.

### 4.4 Backfill

Sleeper keeps historical matchups, so weeks that pass before this ships can be
backfilled by looping `/matchups/{week}` for 1..current. **Caveat:** backfilled
weeks join against *current* cap values, not the values in force at the time —
acceptable if you backfill early in the season, worth a footnote in the UI.
Shipping in week 1 means there is nothing to backfill.

### 4.5 The graph

`recharts@^2.8.0` is already a dependency and `CapByPositionChart.tsx` exists to
match for styling.

`GET /api/season/points` reads sealed weeks and returns:

```ts
{ weeks: number[],
  teams: [{ team_id, team_name, weekly: number[], cumulative: number[],
            cumulativePpm: number[] }] }
```

Rendered on the dashboard (`src/pages/index.tsx`) above the team grid.

**12 lines is a spaghetti chart.** Design decisions that keep it readable:
- Default view is **cumulative points** (the "running tally" you asked for).
- Mode toggle: `Cumulative | Weekly | vs. League Median | Cumulative PPM`.
  The PPM mode is the one that's unique to this league.
- Muted palette by default; hover a line (or its legend entry) to emphasize it
  and dim the rest. Click legend entries to pin/unpin teams.
- Highlight the signed-in user's own team by default.
- "vs. Median" is the most legible mode for 12 teams — every line is a
  divergence from 0 rather than 12 near-parallel climbing lines.

---

## 5. Phase 3 — Tuesday weekly recap

`/recap/[week]`, generated from the sealed snapshot, latest linked from the
dashboard.

### 5.1 Awards you asked for

All "cap used" figures are **active cap = sum of `cap_value` over the 15
starters**, bench excluded.

| Award | Definition |
|---|---|
| **Moneyball** | Lowest active cap among winners |
| **Sledgehammer** | Highest active cap among winners ("you paid full price") |
| **Money Burned** | Highest active cap among losers |
| **Thrift Store Loss** | Lowest active cap among losers |
| **Best Value Player** | Highest starter PPM, `cap_value >= $1M` |
| **Biggest Bust** | Lowest starter PPM, `cap_value >= $10M` (so it's a real contract, e.g. "$48M for 3.2 points") |
| **Team Efficiency** | Team PPM ranking for the week |

### 5.2 Additional tidbits worth generating

- **Bench Regret** — optimal-lineup points minus actual points. Requires a slot
  solver: `SUPER_FLEX` accepts QB/RB/WR/TE, `IDP_FLEX` accepts DL/LB/DB. Greedy
  assignment from most-constrained slot outward is correct enough here.
- **Would've/Could've** — flag losses where the margin was smaller than the
  best benched player's points. Reliably the most-quoted line in any recap.
- **All-play record** — each team's record against all 11 other teams that week.
  Cheap to compute and gives you *Luckiest Team* (won with a bottom-3 score) and
  *Hard-Luck Loser* (lost with a top-3 score).
- **Closest game / biggest blowout.**
- **Positional value report** — league-wide PPM by position group. In a deep IDP
  league (DL/DL/LB/LB/DB/DB + IDP_FLEX + K) this will show whether the capsheet
  systematically misprices IDP relative to offense. Genuinely actionable.
- **Cap efficiency standings** — season-long PPM per team, a second standings
  table alongside W/L. This is the stat that makes the league's gimmick legible.

### 5.3 Prose

Keep every **fact** deterministic and computed. Optionally add one LLM-generated
paragraph that narrates the computed facts (Claude API from an API route, facts
passed in as structured JSON, prose stored on the recap doc so it's stable and
not regenerated on each view). Nice-to-have, not load-bearing.

---

## 6. Phase 4 — Further enhancements

Ranked by value-for-effort in this league specifically.

1. **Cap efficiency standings page** — season PPM, active-cap-per-win, plus a
   scatter of active cap vs. points scored. Best payoff for the least work; all
   the data is already in sealed weeks.
2. **Bye-week cap exposure** — `CapNumberRow` already carries `bye_week`.
   "Week 9: you have $62M on bye." Pure derivation from data you already parse.
3. **FAAB tracker** — `/league/{id}/transactions/{week}` gives adds/drops and
   FAAB bids (budget is 100). Show spend-to-date, and *points produced per FAAB
   dollar* — the same efficiency lens applied to waivers.
4. **Power rankings** — blend points scored, cap efficiency, and all-play
   record. Publishes alongside the recap.
5. **Playoff odds** — Monte Carlo over the remaining schedule using each team's
   weekly point distribution. 6 of 12 make it, starting week 15. Becomes
   interesting around week 8.
6. **Value over replacement (VOR) per $M** — replacement level = median points
   among league-wide starters at that slot. Turns "he scored 14" into "he scored
   6 above what anyone could have started, for $22M."
7. **Trade evaluator** — projected PPM swing for both sides, plus cap-space
   impact. Trade deadline is week 11, so ship before ~week 8.
8. **Trade deadline + roster deadline countdown** on the dashboard.
9. **Tuesday notification** — email or FCM push when the recap seals. Needs the
   scheduled-job path from §4.3.
10. **Season awards page** — aggregate weekly awards at week 14. Cheap once
    recaps exist, and it's the thing people actually screenshot.

---

## 7. Suggested build order

| Phase | Scope | Ship by |
|---|---|---|
| **1** | ✅ **Built** — `matchups.ts`, `/api/matchups/*`, `/matchups`, `/matchups/[week]/[id]`, PPM | Before Sun 9/13 |
| **1b** | 60s coalescing, auto-refresh toggle, mobile gameday layout | Week 2 |
| **2** | Week sealing, `weeks/` snapshots, `/api/season/points`, dashboard graph | Week 3-4 |
| **3** | Recap generation, `/recap/[week]`, awards | Before week 5 |
| **4** | Enhancements, prioritized above | Rest of season |

## 8. Decisions made

Settled 2026-09-09, implemented in `src/lib/utils/efficiency.ts`:

1. **PPM is the primary unit** — points per $1M of cap, labelled "pts / $1M" in
   the UI. Cost-per-point is the secondary framing, shown alongside.
2. **Zero-cap players return `null`, never `Infinity` or `0`.** Rendered as an
   em dash with the existing `ZeroCapWarning` badge.
3. **Efficiency awards and leaderboards have a `$1M` cap floor**
   (`MIN_CAP_FOR_EFFICIENCY_AWARDS`), so a cheap flier can't win on a rounding
   artifact. Display of an individual player's PPM is not floored — only
   rankings are.
4. **Weeks are sealed to immutable snapshots** (§4.1). Non-negotiable, because
   Tuesday waivers and editable cap values both corrupt any recomputation.

Three design points settled while building Phase 1, which Phase 2 depends on:

- **The scoreboard cache is keyed by league id, not season.** Sleeper issues a
  new league id per season, so the id already identifies the season — while
  `/state/nfl`'s season rolls over to the next year in January, before a league
  finishes its own. Keying by season would file January's reads and writes
  under the wrong year. **The sealed-week snapshots in §4.2 must use
  `league.season` (or the league id) for the same reason** — never
  `/state/nfl`'s.
- **The two sides of a matchup are ordered by team id, never by score.**
  Score-ordering looks stable on a finished week but swaps the two columns
  mid-game the moment the lead changes, which is exactly when someone is
  watching. Who leads is carried by `leader_team_id`.
- **The league's starting slots ship on the scoreboard** (`starting_slots`,
  from `roster_positions`) rather than being hardcoded in the UI, so a
  commissioner changing roster settings can't silently mislabel every lineup.

## 9. Open questions

1. **Award cap floors** — $1M for Best Value, $10M for Biggest Bust are starting
   guesses. Worth tuning once real week-1 numbers exist.
2. **Recap visibility** — league-wide, or commissioner-reviewed before publish?
   Plan assumes it auto-publishes on seal.
3. **Playoff weeks** — do matchups/recaps continue through weeks 15-17 using the
   bracket endpoints, or does the regular-season view stop at week 14?
   Phase 1 bounds the week selector at `last_regular_season_week` (14) but the
   API accepts 1-18, so extending later is a UI-only change.
