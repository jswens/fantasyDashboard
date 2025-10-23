import fs from 'fs';
import path from 'path';
import { SleeperPlayer } from '@/lib/types/sleeper';
import { CapNumbersData, CapNumberRow } from '@/lib/types/sleeper';

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
      
      // Skip header line and parse each row
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
    
    // Don't forget the last field
    result.push(current.trim());
    
    return result;
  }

  async createProcessedPlayersCache(): Promise<boolean> {
    try {
      console.log('Creating processed players cache...');
      
      // Read raw players from Sleeper API cache
      const rawPlayers = await this.readPlayersFromFile();
      if (!rawPlayers) {
        console.error('No raw players data found');
        return false;
      }

      // Read cap data from CSV
      const capRows = await this.readCapsheetCSV();
      if (capRows.length === 0) {
        console.error('No cap data found in CSV');
        return false;
      }

      console.log(`Processing ${Object.keys(rawPlayers).length} players with ${capRows.length} cap entries`);

      // Process players with cap numbers
      const processedPlayers: Record<string, SleeperPlayer & { cap_value: number; cap_value_formatted: string; search_name: string; has_zero_cap_warning: boolean; }> = {};
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

      // Save processed players to cache
      const cacheFilePath = path.join(this.dataDir, 'processed-players-cache.json');
      fs.writeFileSync(cacheFilePath, JSON.stringify({
        timestamp: new Date().toISOString(),
        zero_cap_warning_count: zeroCapHitCount,
        total_players: Object.keys(processedPlayers).length,
        players: processedPlayers
      }, null, 2));

      console.log(`Cached ${Object.keys(processedPlayers).length} processed players`);
      return true;
    } catch (error) {
      console.error('Error creating processed players cache:', error);
      return false;
    }
  }

  private findPlayerCapNumberFromRows(player: SleeperPlayer, capRows: CapNumberRow[]): string | null {
    const playerTeam = player.team;
    const playerPosition = player.position;

    // Team abbreviation mapping from Sleeper to capsheet format
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

    // Helper function to normalize names (remove suffixes like Jr., III, etc.)
    const normalizeName = (name: string): string => {
      return name.toLowerCase()
        .replace(/\s+(jr\.?|sr\.?|iii|iv|ii)$/i, '')
        .replace(/[^a-z\s]/g, '')
        .trim();
    };

    // Helper function for nickname/common name variations
    const getNameVariations = (firstName: string, lastName: string): string[] => {
      const variations = [`${firstName} ${lastName}`];
      
      // Common nickname mappings
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

      // Add nickname variations
      const lowerFirst = firstName.toLowerCase();
      if (nicknames[lowerFirst]) {
        for (const variation of nicknames[lowerFirst]) {
          variations.push(`${variation} ${lastName}`);
        }
      }

      // Add common spelling variations
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

    // Try different matching strategies
    const nameVariations = getNameVariations(player.first_name, player.last_name);
    
    for (const row of capRows) {
      // Strategy 1: Try all name variations with exact team match
      for (const nameVariation of nameVariations) {
        if (row.name.toLowerCase() === nameVariation.toLowerCase() && 
            (row.team === fullTeamName || row.abbreviation === playerTeam)) {
          return row.salary_cap;
        }
      }

      // Strategy 2: Try all name variations with normalized names and team match
      for (const nameVariation of nameVariations) {
        const normalizedRowName = normalizeName(row.name);
        const normalizedVariation = normalizeName(nameVariation);
        
        if (normalizedRowName === normalizedVariation && 
            (row.team === fullTeamName || row.abbreviation === playerTeam)) {
          return row.salary_cap;
        }
      }

      // Strategy 3: Name match with position verification (for when team data is unreliable)
      for (const nameVariation of nameVariations) {
        const normalizedRowName = normalizeName(row.name);
        const normalizedVariation = normalizeName(nameVariation);
        
        if (normalizedRowName === normalizedVariation && 
            (row.position === playerPosition || row.position_group === playerPosition)) {
          return row.salary_cap;
        }
      }

      // Strategy 4: Exact name match only (fallback when team/position data is missing)
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
      const cacheFilePath = path.join(this.dataDir, 'processed-players-cache.json');
      
      if (!fs.existsSync(cacheFilePath)) {
        return null;
      }

      const fileData = fs.readFileSync(cacheFilePath, 'utf8');
      const cache = JSON.parse(fileData);
      
      // Check if cache is less than 24 hours old
      const cacheTime = new Date(cache.timestamp);
      const now = new Date();
      const hoursDiff = (now.getTime() - cacheTime.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff > 24) {
        console.log('Processed players cache is stale (>24 hours old)');
        return null;
      }

      // Ensure all players have the has_zero_cap_warning property for backward compatibility
      const players = cache.players;
      for (const playerId in players) {
        if (players[playerId] && typeof players[playerId].has_zero_cap_warning === 'undefined') {
          players[playerId].has_zero_cap_warning = players[playerId].cap_value === 0;
        }
      }

      console.log(`Loaded ${Object.keys(cache.players).length} players from processed cache`);
      return players;
    } catch (error) {
      console.error('Error loading processed players cache:', error);
      return null;
    }
  }

  async getZeroCapWarningStats(): Promise<{ zeroCapCount: number; totalPlayers: number; percentage: number } | null> {
    try {
      const cacheFilePath = path.join(this.dataDir, 'processed-players-cache.json');
      
      if (!fs.existsSync(cacheFilePath)) {
        return null;
      }

      const fileData = fs.readFileSync(cacheFilePath, 'utf8');
      const cache = JSON.parse(fileData);
      
      const zeroCapCount = cache.zero_cap_warning_count || 0;
      const totalPlayers = cache.total_players || 0;
      const percentage = totalPlayers > 0 ? (zeroCapCount / totalPlayers) * 100 : 0;
      
      return {
        zeroCapCount,
        totalPlayers,
        percentage: Math.round(percentage * 10) / 10 // Round to 1 decimal place
      };
    } catch (error) {
      console.error('Error getting zero cap warning stats:', error);
      return null;
    }
  }

  async readPlayersFromFile(): Promise<Record<string, SleeperPlayer> | null> {
    try {
      const filePath = path.join(this.dataDir, 'players.json');
      const fileData = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(fileData);
    } catch (error) {
      console.error('Error reading players.json:', error);
      return null;
    }
  }

  async readCapNumbersFromFile(): Promise<CapNumbersData | null> {
    try {
      // cap_numbers.json is in the parent directory
      const filePath = path.join(process.cwd(), '..', 'cap_numbers.json');
      const fileData = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(fileData);
    } catch (error) {
      console.error('Error reading cap_numbers.json:', error);
      return null;
    }
  }

  async writePlayersToFile(players: Record<string, SleeperPlayer>): Promise<boolean> {
    try {
      const filePath = path.join(this.dataDir, 'players.json');
      fs.writeFileSync(filePath, JSON.stringify(players, null, 2));
      return true;
    } catch (error) {
      console.error('Error writing players.json:', error);
      return false;
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

  // Convert currency string to integer (from Python logic)
  convertCurrencyToInt(currencyStr: string | null): number {
    if (currencyStr === null || currencyStr === undefined) {
      return 0;
    }
    const cleanStr = currencyStr.replace(/[$,]/g, '');
    return parseInt(cleanStr, 10) || 0;
  }

  // Match player to cap number (from Python logic)
  findPlayerCapNumber(player: SleeperPlayer, capNumbers: CapNumberRow[]): string | null {
    if (!player.first_name || !player.last_name || !player.team) {
      return null;
    }

    const fullName = `${player.first_name} ${player.last_name}`.toLowerCase();
    
    for (const cap of capNumbers) {
      if (cap.name && cap.abbreviation && cap.salary_cap) {
        const capPlayerName = cap.name.toLowerCase();
        const capTeamCode = cap.abbreviation;
        
        // Match by full name and team
        if (capPlayerName === fullName && capTeamCode === player.team) {
          return cap.salary_cap;
        }
      }
    }
    
    // If exact match failed, try fuzzy matching by checking if names are similar
    for (const cap of capNumbers) {
      if (cap.name && cap.abbreviation && cap.salary_cap) {
        const capPlayerName = cap.name.toLowerCase();
        const capTeamCode = cap.abbreviation;
        
        // Check if the cap name contains both first and last name and team matches
        if (capTeamCode === player.team &&
            capPlayerName.includes(player.first_name.toLowerCase()) &&
            capPlayerName.includes(player.last_name.toLowerCase())) {
          return cap.salary_cap;
        }
      }
    }
    
    return null;
  }

  // Process players with cap numbers (mirroring Python logic)
  async processPlayersWithCapNumbers(): Promise<Record<string, SleeperPlayer & { cap_value: number; cap_value_formatted: string; search_name: string; has_zero_cap_warning: boolean; }> | null> {
    // First try to load from processed cache
    const cachedPlayers = await this.loadProcessedPlayersFromCache();
    if (cachedPlayers) {
      console.log('Using cached processed players');
      return cachedPlayers;
    }

    console.log('Cache miss, generating fresh processed players');
    
    // Create fresh cache
    const success = await this.createProcessedPlayersCache();
    if (!success) {
      console.error('Failed to create processed players cache');
      return null;
    }

    // Load the newly created cache
    return await this.loadProcessedPlayersFromCache();
  }
}
