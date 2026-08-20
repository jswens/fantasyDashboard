import Head from 'next/head';
import { useAuth } from '@/lib/hooks/useAuth';
import GoogleSignIn from '@/components/auth/GoogleSignIn';
import Header from '@/components/common/Header';
import PlayerSearch from '@/components/players/PlayerSearch';
import Loading from '@/components/common/Loading';

export default function PlayersPage() {
  const { user, isAdmin, isCommissioner, loading } = useAuth();

  if (loading) {
    return <Loading />;
  }

  if (!user) {
    return <GoogleSignIn user={null} />;
  }

  return (
    <>
      <Head>
        <title>Players - Fantasy League Dashboard</title>
      </Head>
      <Header title="Players" user={user} isCommissioner={isCommissioner} />
      <PlayerSearch user={user} isCommissioner={isCommissioner} isAdmin={isAdmin} />
    </>
  );
}
