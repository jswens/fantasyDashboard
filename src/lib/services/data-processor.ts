import fs from 'fs';
import path from 'path';
import { SleeperPlayer } from '@/lib/types/sleeper';
import { CapNumbersData, CapNumberRow } from '@/lib/types/sleeper';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const PLAYERS_COLLECTION = 'players';
const PLAYERS_META_DOC = 'playersMeta';
const PLAYERS_CACHE_TTL_HOURS = 24;

export class DataProcessor {
  private dataDir: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
  }

  async readCapsheetCSV(): Promise<CapNumberRow[]> {
    try {
      const filePath = path.join(this.dataDir, 'capsheet.csv');
      const fileData = fs.readFileSync(filePath, 'utf8');
      const lines = fileData.split('\n');

      const capRows: CapNumberRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const columns = this.parseCSVLine(line);
        if (columns.length >= 4) {
          capRows.push({
            lookup_key: columns[0],
            name: columns[1],
            position: columns[2],
            salary_cap: columns[3],
            team: columns[4] || '',
            position_group: columns[5] || '',
            abbreviation: columns[6] || '',
            bye_week: columns[7] || ''
          });
        }
      }

      return capRows;
    } catch (error) {
      console.error('Error reading capsheet.csv:', error);
      return [];
    }
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  async createProcessedPlayersCache(rawPlayers: Record<string, SleeperPlayer>): Promise<boolean> {
    try {
      console.log('Creating processed players cache in Firestore...');

      const capRows = await this.readCapsheetCSV();
      if (capRows.length === 0) {
        console.error('No cap data found in CSV');
        return false;
      }

      console.log(`Processing ${Object.keys(rawPlayers).length} players with ${capRows.length} cap entries`);

      type ProcessedPlayer = SleeperPlayer & {
        cap_value: number;
        cap_value_formatted: string;
        search_name: string;
        has_zero_cap_warning: boolean;
      };

      const processedPlayers: Record<string, ProcessedPlayer> = {};
      let zeroCapHitCount = 0;

      for (const [playerId, player] of Object.entries(rawPlayers)) {
        if (player && player.team) {
          const capNumber = this.findPlayerCapNumberFromRows(player, capRows);
          const capValue = this.convertCurrencyToInt(capNumber);
          const hasZeroCapWarning = capValue === 0;

          if (hasZeroCapWarning) {
            zeroCapHitCount++;
          }

          processedPlayers[playerId] = {
            ...player,
            cap_value: capValue,
            cap_value_formatted: capNumber || '$0',
            search_name: `${player.first_name} ${player.last_name}`.toLowerCase(),
            has_zero_cap_warning: hasZeroCapWarning,
          };
        }
      }

      console.log(`⚠️  Warning: ${zeroCapHitCount} players have zero cap hit`);

      // Batch write to Firestore in chunks of 500 (Firestore limit)
      const playerEntries = Object.entries(processedPlayers);
      const BATCH_SIZE = 500;

      for (let i = 0; i < playerEntries.length; i += BATCH_SIZE) {
        const chunk = playerEntries.slice(i, i + BATCH_SIZE);
        const batch = adminDb.batch();

        for (const [playerId, player] of chunk) {
          const docRef = adminDb.collection(PLAYERS_COLLECTION).doc(playerId);
          batch.set(docRef, player);
        }

        await batch.commit();
        console.log(`Wrote players batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(playerEntries.length / BATCH_SIZE)}`);
      }

      // Write metadata doc
      await adminDb.collection('cache').doc(PLAYERS_META_DOC).set({
        cachedAt: FieldValue.serverTimestamp(),
        totalPlayers: playerEntries.length,
        zeroCapWarningCount: zeroCapHitCount,
      });

      console.log(`Cached ${playerEntries.length} processed players to Firestore`);
      return true;
    } catch (error) {
      console.error('Error creating processed players cache:', error);
      return false;
    }
  }

  private findPlayerCapNumberFromRows(player: SleeperPlayer, capRows: CapNumberRow[]): string | null {
    const playerTeam = player.team;
    const playerPosition = player.position;

    const teamMapping: Record<string, string> = {
      'ARI': 'Arizona Cardinals',
      'ATL': 'Atlanta Falcons',
      'BAL': 'Baltimore Ravens',
      'BUF': 'Buffalo Bills',
      'CAR': 'Carolina Panthers',
      'CHI': 'Chicago Bears',
      'CIN': 'Cincinnati Bengals',
      'CLE': 'Cleveland Browns',
      'DAL': 'Dallas Cowboys',
      'DEN': 'Denver Broncos',
      'DET': 'Detroit Lions',
      'GB': 'Green Bay Packers',
      'HOU': 'Houston Texans',
      'IND': 'Indianapolis Colts',
      'JAX': 'Jacksonville Jaguars',
      'KC': 'Kansas City Chiefs',
      'LV': 'Las Vegas Raiders',
      'LAC': 'Los Angeles Chargers',
      'LAR': 'Los Angeles Rams',
      'MIA': 'Miami Dolphins',
      'MIN': 'Minnesota Vikings',
      'NE': 'New England Patriots',
      'NO': 'New Orleans Saints',
      'NYG': 'New York Giants',
      'NYJ': 'New York Jets',
      'PHI': 'Philadelphia Eagles',
      'PIT': 'Pittsburgh Steelers',
      'SF': 'San Francisco 49ers',
      'SEA': 'Seattle Seahawks',
      'TB': 'Tampa Bay Buccaneers',
      'TEN': 'Tennessee Titans',
      'WAS': 'Washington Commanders'
    };

    const fullTeamName = teamMapping[playerTeam || ''] || playerTeam;

    const normalizeName = (name: string): string => {
      return name.toLowerCase()
        .replace(/\s+(jr\.?|sr\.?|iii|iv|ii)$/i, '')
        .replace(/[^a-z\s]/g, '')
        .trim();
    };

    const getNameVariations = (firstName: string, lastName: string): string[] => {
      const variations = [`${firstName} ${lastName}`];

      const nicknames: Record<string, string[]> = {
        'cam': ['cameron'],
        'cameron': ['cam'],
        'pat': ['patrick'],
        'patrick': ['pat'],
        'mike': ['michael'],
        'michael': ['mike'],
        'chris': ['christopher'],
        'christopher': ['chris'],
        'matt': ['matthew'],
        'matthew': ['matt'],
        'rob': ['robert'],
        'robert': ['rob'],
        'dave': ['david'],
        'david': ['dave'],
        'steve': ['steven'],
        'steven': ['steve']
      };

      const lowerFirst = firstName.toLowerCase();
      if (nicknames[lowerFirst]) {
        for (const variation of nicknames[lowerFirst]) {
          variations.push(`${variation} ${lastName}`);
        }
      }

      const spellingVariations: Record<string, string[]> = {
        'terrance': ['terrence'],
        'terrence': ['terrance']
      };

      if (spellingVariations[firstName.toLowerCase()]) {
        for (const variation of spellingVariations[firstName.toLowerCase()]) {
          variations.push(`${variation} ${lastName}`);
        }
      }

      return variations;
    };

    const nameVariations = getNameVariations(player.first_name, player.last_name);

    for (const row of capRows) {
      for (const nameVariation of nameVariations) {
        if (row.name.toLowerCase() === nameVariation.toLowerCase() &&
            (row.team === fullTeamName || row.abbreviation === playerTeam)) {
          return row.salary_cap;
        }
      }

      for (const nameVariation of nameVariations) {
        const normalizedRowName = normalizeName(row.name);
        const normalizedVariation = normalizeName(nameVariation);

        if (normalizedRowName === normalizedVariation &&
            (row.team === fullTeamName || row.abbreviation === playerTeam)) {
          return row.salary_cap;
        }
      }

      for (const nameVariation of nameVariations) {
        const normalizedRowName = normalizeName(row.name);
        const normalizedVariation = normalizeName(nameVariation);

        if (normalizedRowName === normalizedVariation &&
            (row.position === playerPosition || row.position_group === playerPosition)) {
          return row.salary_cap;
        }
      }

      for (const nameVariation of nameVariations) {
        const normalizedRowName = normalizeName(row.name);
        const normalizedVariation = normalizeName(nameVariation);

        if (normalizedRowName === normalizedVariation) {
          return row.salary_cap;
        }
      }
    }

    return null;
  }

  async loadProcessedPlayersFromCache(): Promise<Record<string, SleeperPlayer & { cap_value: number; cap_value_formatted: string; search_name: string; has_zero_cap_warning: boolean; }> | null> {
    try {
      // Check metadata doc for TTL
      const metaDoc = await adminDb.collection('cache').doc(PLAYERS_META_DOC).get();
      if (!metaDoc.exists) return null;

      const meta = metaDoc.data()!;
      const cachedAt = meta.cachedAt?.toDate?.() as Date | undefined;
      if (!cachedAt) return null;

      const hoursDiff = (Date.now() - cachedAt.getTime()) / (1000 * 60 * 60);
      if (hoursDiff > PLAYERS_CACHE_TTL_HOURS) {
        console.log('Processed players cache is stale (>24 hours old)');
        return null;
      }

      // Read all player documents
      const snapshot = await adminDb.collection(PLAYERS_COLLECTION).get();
      if (snapshot.empty) return null;

      const players: Record<string, SleeperPlayer & { cap_value: number; cap_value_formatted: string; search_name: string; has_zero_cap_warning: boolean; }> = {};
      snapshot.forEach(doc => {
        const data = doc.data() as SleeperPlayer & { cap_value: number; cap_value_formatted: string; search_name: string; has_zero_cap_warning: boolean; };
        if (typeof data.has_zero_cap_warning === 'undefined') {
          data.has_zero_cap_warning = data.cap_value === 0;
        }
        players[doc.id] = data;
      });

      console.log(`Loaded ${Object.keys(players).length} players from Firestore cache`);
      return players;
    } catch (error) {
      console.error('Error loading processed players cache from Firestore:', error);
      return null;
    }
  }

  async getZeroCapWarningStats(): Promise<{ zeroCapCount: number; totalPlayers: number; percentage: number } | null> {
    try {
      const metaDoc = await adminDb.collection('cache').doc(PLAYERS_META_DOC).get();
      if (!metaDoc.exists) return null;

      const meta = metaDoc.data()!;
      const zeroCapCount = meta.zeroCapWarningCount || 0;
      const totalPlayers = meta.totalPlayers || 0;
      const percentage = totalPlayers > 0 ? (zeroCapCount / totalPlayers) * 100 : 0;

      return {
        zeroCapCount,
        totalPlayers,
        percentage: Math.round(percentage * 10) / 10
      };
    } catch (error) {
      console.error('Error getting zero cap warning stats:', error);
      return null;
    }
  }

  // Kept for compatibility — raw player data is no longer persisted separately
  async readPlayersFromFile(): Promise<Record<string, SleeperPlayer> | null> {
    return null;
  }

  async writePlayersToFile(_players: Record<string, SleeperPlayer>): Promise<boolean> {
    return true;
  }

  async readCapNumbersFromFile(): Promise<CapNumbersData | null> {
    try {
      const filePath = path.join(process.cwd(), '..', 'cap_numbers.json');
      const fileData = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(fileData);
    } catch (error) {
      console.error('Error reading cap_numbers.json:', error);
      return null;
    }
  }

  async writeCapNumbersToFile(capNumbers: CapNumbersData): Promise<boolean> {
    try {
      const filePath = path.join(this.dataDir, 'cap_numbers.json');
      fs.writeFileSync(filePath, JSON.stringify(capNumbers, null, 2));
      return true;
    } catch (error) {
      console.error('Error writing cap_numbers.json:', error);
      return false;
    }
  }

  convertCurrencyToInt(currencyStr: string | null): number {
    if (currencyStr === null || currencyStr === undefined) {
      return 0;
    }
    const cleanStr = currencyStr.replace(/[$,]/g, '');
    return parseInt(cleanStr, 10) || 0;
  }

  findPlayerCapNumber(player: SleeperPlayer, capNumbers: CapNumberRow[]): string | null {
    if (!player.first_name || !player.last_name || !player.team) {
      return null;
    }

    const fullName = `${player.first_name} ${player.last_name}`.toLowerCase();

    for (const cap of capNumbers) {
      if (cap.name && cap.abbreviation && cap.salary_cap) {
        const capPlayerName = cap.name.toLowerCase();
        const capTeamCode = cap.abbreviation;

        if (capPlayerName === fullName && capTeamCode === player.team) {
          return cap.salary_cap;
        }
      }
    }

    for (const cap of capNumbers) {
      if (cap.name && cap.abbreviation && cap.salary_cap) {
        const capPlayerName = cap.name.toLowerCase();
        const capTeamCode = cap.abbreviation;

        if (capTeamCode === player.team &&
            capPlayerName.includes(player.first_name.toLowerCase()) &&
            capPlayerName.includes(player.last_name.toLowerCase())) {
          return cap.salary_cap;
        }
      }
    }

    return null;
  }

  async processPlayersWithCapNumbers(): Promise<Record<string, SleeperPlayer & { cap_value: number; cap_value_formatted: string; search_name: string; has_zero_cap_warning: boolean; }> | null> {
    const cachedPlayers = await this.loadProcessedPlayersFromCache();
    if (cachedPlayers) {
      console.log('Using cached processed players');
      return cachedPlayers;
    }

    console.log('Cache miss — cannot generate without raw players; trigger a data refresh');
    return null;
  }
}
