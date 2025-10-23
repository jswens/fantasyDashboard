// Fallback data processor for browser environment
// This version works without Node.js fs module for development
import { SleeperPlayer, CapNumberRow } from '@/lib/types/sleeper';

export class BrowserDataProcessor {
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
          return cap.salary_cap; // Cap number from salary_cap property
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

  // Process players with cap numbers using provided data
  processPlayersWithCapNumbers(players: Record<string, SleeperPlayer>, capNumbers: CapNumberRow[]): Record<string, SleeperPlayer & { cap_value: number; cap_value_formatted: string; search_name: string; }> {
    if (!players || !capNumbers) {
      return {};
    }

    // Filter players with valid NFL teams and add cap numbers
    const processedPlayers: Record<string, SleeperPlayer & { cap_value: number; cap_value_formatted: string; search_name: string; }> = {};

    for (const [playerId, player] of Object.entries(players)) {
      if (player && player.team) {
        const capNumber = this.findPlayerCapNumber(player, capNumbers);
        
        processedPlayers[playerId] = {
          ...player,
          cap_value: this.convertCurrencyToInt(capNumber),
          cap_value_formatted: capNumber || '$0',
          search_name: `${player.first_name} ${player.last_name}`.toLowerCase(),
        };
      }
    }

    return processedPlayers;
  }
}
