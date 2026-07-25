import { SleeperDraft, SleeperDraftPick, SleeperDraftSummary } from '@/lib/types/draft';

// Wraps the public Sleeper draft endpoints (no auth required).
// Follows the same fetch/error-handling pattern as SleeperService (sleeper-api.ts).
export class DraftService {
  private baseUrl = 'https://api.sleeper.app/v1';
  private leagueId: string;

  constructor(leagueId: string) {
    this.leagueId = leagueId;
  }

  async getDrafts(): Promise<SleeperDraftSummary[] | null> {
    try {
      const response = await fetch(`${this.baseUrl}/league/${this.leagueId}/drafts`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching league drafts:', error);
      return null;
    }
  }

  /** Finds the current/most recent draft for the league (drafting/paused first, else most recently created). */
  async getCurrentDraft(): Promise<SleeperDraftSummary | null> {
    const drafts = await this.getDrafts();
    if (!drafts || drafts.length === 0) return null;

    const inProgress = drafts.find(d => d.status === 'drafting' || d.status === 'paused');
    if (inProgress) return inProgress;

    return [...drafts].sort((a, b) => b.created - a.created)[0];
  }

  async getDraft(draftId: string): Promise<SleeperDraft | null> {
    try {
      const response = await fetch(`${this.baseUrl}/draft/${draftId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching draft:', error);
      return null;
    }
  }

  async getPicks(draftId: string): Promise<SleeperDraftPick[] | null> {
    try {
      const response = await fetch(`${this.baseUrl}/draft/${draftId}/picks`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching draft picks:', error);
      return null;
    }
  }
}
