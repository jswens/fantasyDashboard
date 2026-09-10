// Cap efficiency metric shared by the matchup views and (later) the weekly
// recap awards.
//
// The league cap is ~$201M and individual cap hits run into the tens of
// millions, so literal "points per dollar" is a number like 0.00000047. The
// metric used everywhere is points per $1M of cap -- "PPM". A $55M QB scoring
// 27.3 is 0.50 PPM.

export const MILLION = 1_000_000;

// Players below this cap hit are excluded from efficiency LEADERBOARDS and
// awards. Without a floor a $500k flier scoring 12 points posts a PPM of 24
// and wins every week, which makes the award meaningless. This does not affect
// per-player PPM display, only rankings.
export const MIN_CAP_FOR_EFFICIENCY_AWARDS = 1_000_000;

// Points per $1M of cap.
//
// Returns null for a zero (or missing) cap hit rather than Infinity or 0. The
// league has real $0-cap players -- see has_zero_cap_warning, the
// ZeroCapWarning component and /players/zero-cap -- and treating them as
// infinitely efficient would let them win every efficiency comparison forever.
// Callers render null as an em dash next to the existing zero-cap badge.
//
// Negative points are legitimate (turnovers, IDP scoring) and produce a
// negative PPM, which is the honest answer.
export function pointsPerMillion(points: number, capValue: number): number | null {
  if (!Number.isFinite(points) || !Number.isFinite(capValue)) return null;
  if (capValue <= 0) return null;
  return points / (capValue / MILLION);
}

// Cap dollars spent per fantasy point, the inverse framing of PPM.
//
// null when the cap hit is zero (same reason as above) and also when points are
// zero or negative -- "cost per point" has no meaning when no points were
// produced, and dividing would give Infinity or a negative dollar figure.
export function costPerPoint(points: number, capValue: number): number | null {
  if (!Number.isFinite(points) || !Number.isFinite(capValue)) return null;
  if (capValue <= 0 || points <= 0) return null;
  return capValue / points;
}

// Whether a player may appear in an efficiency ranking or win an efficiency
// award. Zero-cap players are excluded by the same floor.
export function isEfficiencyEligible(capValue: number): boolean {
  return Number.isFinite(capValue) && capValue >= MIN_CAP_FOR_EFFICIENCY_AWARDS;
}

// PPM for display. Two decimals -- one loses the difference between a 0.45 and
// a 0.51, three is false precision on a stat built from half-point scoring.
export function formatPpm(ppm: number | null): string {
  if (ppm === null) return '—';
  return ppm.toFixed(2);
}

// Cost per point for display, in millions: "$2.01M / pt".
export function formatCostPerPoint(cost: number | null): string {
  if (cost === null) return '—';
  return `$${(cost / MILLION).toFixed(2)}M / pt`;
}

// Compact cap figure for dense tables where formatIntAsCurrency's full
// "$55,000,000" is too wide: "$55.0M", "$750K", "$0".
export function formatCapCompact(capValue: number): string {
  if (!Number.isFinite(capValue) || capValue === 0) return '$0';
  const abs = Math.abs(capValue);
  const sign = capValue < 0 ? '-' : '';
  if (abs >= MILLION) return `${sign}$${(abs / MILLION).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${abs}`;
}

// Fantasy points for display. Sleeper reports two decimals; scoring is at most
// hundredths, so this neither rounds away real differences nor invents digits.
export function formatPoints(points: number): string {
  if (!Number.isFinite(points)) return '0.00';
  return points.toFixed(2);
}
