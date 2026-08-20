import Head from 'next/head';
import { useAuth } from '@/lib/hooks/useAuth';
import GoogleSignIn from '@/components/auth/GoogleSignIn';
import Header from '@/components/common/Header';
import FreeAgentsDisplay from '@/components/free-agents/FreeAgentsDisplay';
import Loading from '@/components/common/Loading';

export default function FreeAgentsPage() {
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
        <title>Free Agents - Fantasy League Dashboard</title>
      </Head>
      <Header title="Free Agents" user={user} isCommissioner={isCommissioner} />
      <FreeAgentsDisplay user={user} isAdmin={isAdmin} />
    </>
  );
}
