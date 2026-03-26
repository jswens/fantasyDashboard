import { useAuth } from '@/lib/hooks/useAuth';
import GoogleSignIn from '@/components/auth/GoogleSignIn';
import FreeAgentsDisplay from '@/components/free-agents/FreeAgentsDisplay';
import Loading from '@/components/common/Loading';

export default function FreeAgentsPage() {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return <Loading />;
  }

  if (!user) {
    return <GoogleSignIn user={null} />;
  }

  return <FreeAgentsDisplay user={user} isAdmin={isAdmin} />;
}
