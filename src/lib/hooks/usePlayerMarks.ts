import { useCallback, useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import { PlayerMarkType, PlayerMarksMap } from '@/lib/types/marks';

interface UsePlayerMarksResult {
  marks: PlayerMarksMap;
  loading: boolean;
  error: string;
  /** Returns the mark type for a player, or null if unmarked. */
  getMark: (playerId: string) => PlayerMarkType | null;
  /** Sets (or clears, when mark is null) the mark for a player. Optimistic + persists via the API. */
  setMark: (playerId: string, mark: PlayerMarkType | null, note?: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function usePlayerMarks(user: User | null): UsePlayerMarksResult {
  const [marks, setMarks] = useState<PlayerMarksMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadedRef = useRef(false);

  const getAuthHeader = useCallback(async (): Promise<Record<string, string>> => {
    if (!user) return {};
    const idToken = await user.getIdToken();
    return { Authorization: `Bearer ${idToken}` };
  }, [user]);

  const refresh = useCallback(async () => {
    if (!user) {
      setMarks({});
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const headers = await getAuthHeader();
      const response = await fetch('/api/user/marks', { headers });
      const data = await response.json();

      if (data.success) {
        setMarks(data.marks || {});
        setError('');
      } else {
        setError(data.message || 'Failed to load player marks');
      }
    } catch (err) {
      console.error('Error loading player marks:', err);
      setError('Network error loading player marks');
    } finally {
      setLoading(false);
    }
  }, [user, getAuthHeader]);

  useEffect(() => {
    if (!user) {
      setMarks({});
      setLoading(false);
      return;
    }
    if (!loadedRef.current) {
      loadedRef.current = true;
      refresh();
    }
  }, [user, refresh]);

  const getMark = useCallback(
    (playerId: string): PlayerMarkType | null => marks[playerId]?.mark ?? null,
    [marks]
  );

  const setMark = useCallback(
    async (playerId: string, mark: PlayerMarkType | null, note?: string) => {
      if (!user) return;

      const previous = marks[playerId];

      // Optimistic update
      setMarks(prev => {
        const next = { ...prev };
        if (mark === null) {
          delete next[playerId];
        } else {
          next[playerId] = {
            playerId,
            mark,
            note,
            season: previous?.season || '',
            updatedAt: new Date().toISOString(),
          };
        }
        return next;
      });

      try {
        const headers = await getAuthHeader();
        const response = await fetch('/api/user/marks', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId, mark, note }),
        });
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.message || 'Failed to save mark');
        }
      } catch (err) {
        console.error('Error saving player mark:', err);
        setError('Failed to save mark, please try again');
        // Roll back optimistic update
        setMarks(prev => {
          const next = { ...prev };
          if (previous) {
            next[playerId] = previous;
          } else {
            delete next[playerId];
          }
          return next;
        });
      }
    },
    [user, marks, getAuthHeader]
  );

  return { marks, loading, error, getMark, setMark, refresh };
}
