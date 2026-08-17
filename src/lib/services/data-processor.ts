import fs from 'fs';
import path from 'path';
import { SleeperPlayer } from '@/lib/types/sleeper';
import { PlayerPoolFile } from '@/lib/types/playerPool';
import { formatCapHit } from '@/lib/services/cap-numbers';
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

  loadPlayerPool(): PlayerPoolFile | null {
    try {
      const filePath = path.join(this.dataDir, 'players.json');
      const fileData = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(fileData) as PlayerPoolFile;
    } catch (error) {
      console.error('Error reading data/players.json:', error);
      return null;
    }
  }

  async createProcessedPlayersCache(): Promise<boolean> {
    try {
      console.log('Creating processed players cache in Firestore...');

      const pool = this.loadPlayerPool();
      if (!pool) {
        console.error('No player pool data found (data/players.json)');
        return false;
      }

      console.log(`Processing ${Object.keys(pool.players).length} players from data/players.json (season ${pool.season})`);

      type ProcessedPlayer = SleeperPlayer & {
        cap_value: number;
        cap_value_formatted: string;
        search_name: string;
        has_zero_cap_warning: boolean;
      };

      const processedPlayers: Record<string, ProcessedPlayer> = {};
      let zeroCapHitCount = 0;

      for (const [playerId, p] of Object.entries(pool.players)) {
        const hasZeroCapWarning = p.capHit === null || p.capHit === 0;
        if (hasZeroCapWarning) {
          zeroCapHitCount++;
        }

        processedPlayers[playerId] = {
          player_id: p.playerId,
          first_name: p.firstName,
          last_name: p.lastName,
          team: p.team,
          position: p.position,
          years_exp: null,
          active: true,
          cap_value: p.capHit ?? 0,
          cap_value_formatted: p.capHit !== null ? formatCapHit(p.capHit) : '$0',
          search_name: p.searchName,
          has_zero_cap_warning: hasZeroCapWarning,
        };
      }

      console.log(`⚠️  Warning: ${zeroCapHitCount} players have zero/unknown cap hit`);

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
