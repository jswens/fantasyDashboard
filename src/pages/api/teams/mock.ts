import type { NextApiRequest, NextApiResponse } from 'next';
import { Team } from '@/lib/types';

// Mock data until we can install dependencies and use actual services
const mockTeams: Team[] = [
  {
    team_id: '989631512561696768',
    owner_id: 'justin_lea',
    team_name: 'Justin Lea',
    owner_name: 'Justin Lea',
    wins: 8,
    losses: 5,
    ties: 0,
    total_points: 1547.5,
    roster: [],
    salary_cap: 186133333,
    salary_used: 185000000,
    salary_remaining: 15000000,
    roster_size: 16,
    max_roster_size: 16,
  },
  {
    team_id: '77846283045715968',
    owner_id: 'jswens',
    team_name: 'JSwens',
    owner_name: 'JSwens',
    wins: 7,
    losses: 6,
    ties: 0,
    total_points: 1523.2,
    roster: [],
    salary_cap: 186133333,
    salary_used: 178000000,
    salary_remaining: 22000000,
    roster_size: 15,
    max_roster_size: 16,
  },
  {
    team_id: '991170880766099456',
    owner_id: 'randy',
    team_name: 'Randy',
    owner_name: 'Randy',
    wins: 9,
    losses: 4,
    ties: 0,
    total_points: 1612.8,
    roster: [],
    salary_cap: 186133333,
    salary_used: 192000000,
    salary_remaining: 8000000,
    roster_size: 17,
    max_roster_size: 16,
  },
  {
    team_id: '966489703690113024',
    owner_id: 'kicker',
    team_name: 'Kicker',
    owner_name: 'Kicker',
    wins: 6,
    losses: 7,
    ties: 0,
    total_points: 1456.3,
    roster: [],
    salary_cap: 186133333,
    salary_used: 167000000,
    salary_remaining: 33000000,
    roster_size: 14,
    max_roster_size: 16,
  },
  {
    team_id: '989926690593857537',
    owner_id: 'mike',
    team_name: 'Mike',
    owner_name: 'Mike',
    wins: 5,
    losses: 8,
    ties: 0,
    total_points: 1389.7,
    roster: [],
    salary_cap: 186133333,
    salary_used: 203000000,
    salary_remaining: -3000000,
    roster_size: 18,
    max_roster_size: 16,
  },
  {
    team_id: '989979320439328768',
    owner_id: 'dan',
    team_name: 'Dan',
    owner_name: 'Dan',
    wins: 10,
    losses: 3,
    ties: 0,
    total_points: 1689.4,
    roster: [],
    salary_cap: 186133333,
    salary_used: 189000000,
    salary_remaining: 11000000,
    roster_size: 16,
    max_roster_size: 16,
  }
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Return mock data sorted by total points (wins could be used too)
    const sortedTeams = mockTeams.sort((a, b) => b.total_points - a.total_points);
    res.status(200).json(sortedTeams);
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
}
