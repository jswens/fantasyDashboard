import { useState, useEffect } from 'react';
import PasswordForm from '@/components/auth/PasswordForm';
import FreeAgentsDisplay from '@/components/free-agents/FreeAgentsDisplay';

export default function FreeAgentsPage() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  // Check for existing session on page load
  useEffect(() => {
    const savedToken = localStorage.getItem('adminSessionToken');
    if (savedToken) {
      setSessionToken(savedToken);
    }
  }, []);

  const handleAuthenticated = (token: string) => {
    setSessionToken(token);
    localStorage.setItem('adminSessionToken', token);
  };

  const handleLogout = () => {
    setSessionToken(null);
    localStorage.removeItem('adminSessionToken');
  };

  return (
    <>
      {sessionToken ? (
        <FreeAgentsDisplay 
          sessionToken={sessionToken}
          onLogout={handleLogout}
        />
      ) : (
        <PasswordForm onAuthenticated={handleAuthenticated} />
      )}
    </>
  );
}
