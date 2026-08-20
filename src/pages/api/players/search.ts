// GET /api/players/search?q=<query>&position=<pos>&rosterStatus=<all|free_agent|rostered>&sortBy=<name|capHit>&sortDir=<asc|desc>&excludeZeroCap=<true|false>
// GET /api/players/search?zeroCapOnly=true
//
// Authenticated (any signed-in user). Case-insensitive substring search over
// the processed players cache (Firestore `players` collection), returning each
// player's cap number (read directly off the player doc — see
// src/lib/services/player-edit.ts for how commissioner edits and season
// imports write it) plus rostered/free-agent status.
//
// position, rosterStatus, q, and excludeZeroCap all combine (AND'd together) so
// the client can search within an already-filtered slice. sortBy/sortDir control
// ordering, defaulting to name ascending. excludeZeroCap defaults to true — most
// $0 cap hit players are fringe/retired players nobody cares about — pass
// excludeZeroCap=false to include them.
//
// zeroCapOnly=true switches modes: instead of a text search, returns every
// *rostered* player whose cap number is still $0 — the same set the
// "Zero Cap Hit Players" dashboard card counts (src/pages/index.tsx) — with no
// MAX_RESULTS truncation, since fixing all of them is the point.
//
// Commissioners/admins additionally get a "⋮" menu on the client
// (src/components/players/PlayerActionsMenu.tsx) linking to /players/[playerId]
// to edit name/team/cap hit; this endpoint itself is read-only.

import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth } from '@/lib/auth/firebase-auth';
import { adminDb } from '@/lib/firebase-admin';
import { FantasyDataService } from '@/lib/services/fantasy-data';
import { formatCapHit } from '@/lib/services/cap-numbers';
import type { PlayerSearchResponse, PlayerSearchResult } from '@/lib/types/cap';
import type { PlayerEditableField } from '@/lib/types/playerEdit';
import type { SleeperPlayer } from '@/lib/types/sleeper';

type CachedPlayer = SleeperPlayer & { cap_value: number; edited_fields?: PlayerEditableField[] };

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

    const positionRaw = req.query.position;
    const position = (Array.isArray(positionRaw) ? positionRaw[0] : positionRaw || '').trim().toUpperCase();

    const rosterStatusRaw = req.query.rosterStatus;
    const rosterStatus = (Array.isArray(rosterStatusRaw) ? rosterStatusRaw[0] : rosterStatusRaw || 'all').trim();

    // Defaults to true: most $0 cap hit players are fringe/retired players nobody
    // is interested in rostering. Pass excludeZeroCap=false to include them.
    const excludeZeroCapRaw = req.query.excludeZeroCap;
    const excludeZeroCap = (Array.isArray(excludeZeroCapRaw) ? excludeZeroCapRaw[0] : excludeZeroCapRaw) !== 'false';

    const sortByRaw = req.query.sortBy;
    const sortBy = (Array.isArray(sortByRaw) ? sortByRaw[0] : sortByRaw) === 'capHit' ? 'capHit' : 'name';

    const sortDirRaw = req.query.sortDir;
    const sortDir = (Array.isArray(sortDirRaw) ? sortDirRaw[0] : sortDirRaw) === 'desc' ? 'desc' : 'asc';

    const hasFilters = Boolean(query || position || rosterStatus !== 'all' || excludeZeroCap);

    const [playersSnap, teams] = await Promise.all([
      adminDb.collection('players').get(),
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
      const capHit = player.cap_value || 0;

      if (zeroCapOnly) {
        if (!isRostered || capHit !== 0) return;
      } else {
        if (query && !fullName.toLowerCase().includes(query)) return;
        if (position && player.position !== position) return;
        if (rosterStatus === 'free_agent' && isRostered) return;
        if (rosterStatus === 'rostered' && !isRostered) return;
        if (excludeZeroCap && capHit === 0) return;
      }

      results.push({
        playerId: doc.id,
        fullName,
        team: player.team,
        position: player.position,
        capHit,
        capHitFormatted: formatCapHit(capHit),
        isManuallyEdited: (player.edited_fields ?? []).includes('cap_value'),
        isRostered,
        rosterTeamName,
      });
    });

    if (sortBy === 'capHit') {
      results.sort((a, b) => sortDir === 'desc' ? b.capHit - a.capHit : a.capHit - b.capHit);
    } else {
      results.sort((a, b) => sortDir === 'desc' ? b.fullName.localeCompare(a.fullName) : a.fullName.localeCompare(b.fullName));
    }

    // Cap the result set for the default, unfiltered "browse everything" case.
    // Once the client has narrowed things down with a query/position/roster-status
    // filter (or zeroCapOnly's dedicated mode) the point is to see the whole
    // filtered set, so skip truncation.
    const limited = (zeroCapOnly || hasFilters) ? results : results.slice(0, MAX_RESULTS);

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
