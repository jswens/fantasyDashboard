import { useAuth } from '@/lib/hooks/useAuth';
import GoogleSignIn from '@/components/auth/GoogleSignIn';
import PlayerSearch from '@/components/players/PlayerSearch';
import Loading from '@/components/common/Loading';

export default function PlayersPage() {
  const { user, isCommissioner, loading } = useAuth();

  if (loading) {
    return <Loading />;
  }

  if (!user) {
    return <GoogleSignIn user={null} />;
  }

  return <PlayerSearch user={user} isCommissioner={isCommissioner} />;
}
