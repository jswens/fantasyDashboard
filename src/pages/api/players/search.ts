// GET /api/players/search?q=<query>
// GET /api/players/search?zeroCapOnly=true
//
// Authenticated (any signed-in user). Case-insensitive substring search over
// the processed players cache (Firestore `players` collection), returning each
// player's effective cap number (override > season import > legacy capsheet.csv
// — see src/lib/services/cap-numbers.ts) plus rostered/free-agent status.
//
// zeroCapOnly=true switches modes: instead of a text search, returns every
// *rostered* player whose effective cap number is still $0 — the same set the
// "Zero Cap Hit Players" dashboard card counts (src/pages/index.tsx) — with no
// MAX_RESULTS truncation, since fixing all of them is the point.
//
// Admins additionally get an inline edit control on the client (src/pages/players.tsx)
// that calls POST /api/admin/cap-override; this endpoint itself is read-only.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/lib/auth/firebase-auth';
import { adminDb } from '@/lib/firebase-admin';
import { FantasyDataService } from '@/lib/services/fantasy-data';
import { loadCapLayers, resolveEffectiveCapNumber, formatCapHit, getCurrentCapSeason } from '@/lib/services/cap-numbers';
import type { PlayerSearchResponse, PlayerSearchResult } from '@/lib/types/cap';
import type { SleeperPlayer } from '@/lib/types/sleeper';

type CachedPlayer = SleeperPlayer & { cap_value: number };

const MAX_RESULTS = 100;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PlayerSearchResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const decoded = await requireAuth(req);
  if (!decoded) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const qRaw = req.query.q;
    const query = (Array.isArray(qRaw) ? qRaw[0] : qRaw || '').trim().toLowerCase();
    const zeroCapOnlyRaw = req.query.zeroCapOnly;
    const zeroCapOnly = (Array.isArray(zeroCapOnlyRaw) ? zeroCapOnlyRaw[0] : zeroCapOnlyRaw) === 'true';

    const [playersSnap, layers, teams] = await Promise.all([
      adminDb.collection('players').get(),
      loadCapLayers(getCurrentCapSeason()),
      new FantasyDataService().getAllTeams().catch(() => []),
    ]);

    const rosteredPlayerIds = new Map<string, string>(); // playerId -> team_name
    teams.forEach(team => {
      team.roster.forEach(player => {
        rosteredPlayerIds.set(player.player_id, team.team_name);
      });
    });

    const results: PlayerSearchResult[] = [];

    playersSnap.forEach(doc => {
      const player = doc.data() as CachedPlayer;
      if (!player.first_name || !player.last_name) return;

      const fullName = `${player.first_name} ${player.last_name}`;
      const rosterTeamName = rosteredPlayerIds.get(doc.id);
      const isRostered = rosterTeamName !== undefined;
      const effective = resolveEffectiveCapNumber(doc.id, layers, player.cap_value);

      if (zeroCapOnly) {
        if (!isRostered || effective.capHit !== 0) return;
      } else if (query && !fullName.toLowerCase().includes(query)) {
        return;
      }

      results.push({
        playerId: doc.id,
        fullName,
        team: player.team,
        position: player.position,
        capHit: effective.capHit,
        capHitFormatted: formatCapHit(effective.capHit),
        capSource: effective.source,
        isRostered,
        rosterTeamName,
      });
    });

    // Sort alphabetically by name. Cap the result set for the free-text search
    // endpoint use case, but not for zeroCapOnly — the whole point there is to
    // surface every player still needing a fix.
    results.sort((a, b) => a.fullName.localeCompare(b.fullName));
    const limited = zeroCapOnly ? results : results.slice(0, MAX_RESULTS);

    return res.status(200).json({
      success: true,
      message: `Found ${results.length} matching player(s)`,
      data: limited,
      total: results.length,
    });
  } catch (error) {
    console.error('Error searching players:', error);
    return res.status(500).json({ success: false, message: 'Failed to search players' });
  }
}
