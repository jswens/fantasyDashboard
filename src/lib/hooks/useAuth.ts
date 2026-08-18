import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface AuthState {
  user: User | null;
  isAdmin: boolean;
  isCommissioner: boolean;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCommissioner, setIsCommissioner] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          const res = await fetch('/api/auth/role', {
            headers: { Authorization: `Bearer ${idToken}` },
          });
          if (res.ok) {
            const data = await res.json();
            setIsAdmin(data.isAdmin === true);
            setIsCommissioner(data.isCommissioner === true);
          } else {
            setIsAdmin(false);
            setIsCommissioner(false);
          }
        } catch {
          setIsAdmin(false);
          setIsCommissioner(false);
        }
      } else {
        setIsAdmin(false);
        setIsCommissioner(false);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return { user, isAdmin, isCommissioner, loading };
}
