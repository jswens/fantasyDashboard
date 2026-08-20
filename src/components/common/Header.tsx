import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { User } from 'firebase/auth';
import GoogleSignIn from '@/components/auth/GoogleSignIn';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  lastUpdated?: Date;
  onRefresh?: () => void;
  user?: User | null;
  isCommissioner?: boolean;
}

const NAV_LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/free-agents', label: 'Free Agents' },
  { href: '/players', label: 'Players' },
];

const COMMISSIONER_LINK = { href: '/commissioner', label: 'Commissioner' };

export default function Header({
  title = "Fantasy League Dashboard",
  subtitle,
  lastUpdated,
  onRefresh,
  user,
  isCommissioner,
}: HeaderProps) {
  const router = useRouter();
  const navLinks = isCommissioner ? [...NAV_LINKS, COMMISSIONER_LINK] : NAV_LINKS;

  return (
    <header className="bg-sleeper-panel border-b border-sleeper-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-5 gap-6">
          <div className="flex items-center space-x-8 min-w-0">
            <div className="flex items-center space-x-3 min-w-0">
              <Link
                href="/"
                className="flex-shrink-0 w-9 h-9 rounded-lg bg-sleeper-teal-muted border border-sleeper-teal/30 flex items-center justify-center"
              >
                <svg className="w-5 h-5 text-sleeper-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </Link>
              <div className="min-w-0">
                <Link href="/" className="text-xl font-bold text-sleeper-text hover:text-sleeper-teal transition-colors truncate block">
                  {title}
                </Link>
                {subtitle && (
                  <p className="text-sleeper-muted text-xs mt-0.5 truncate">{subtitle}</p>
                )}
                {lastUpdated && (
                  <p className="text-xs text-sleeper-faint truncate">
                    Last updated: {lastUpdated.toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center space-x-2">
              {navLinks.map((link) => {
                const isActive = router.pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
                      isActive
                        ? 'bg-sleeper-teal text-sleeper-bg border-sleeper-teal'
                        : 'bg-transparent text-sleeper-muted border-sleeper-border hover:text-sleeper-text hover:border-sleeper-teal/50'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center space-x-4 flex-shrink-0">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-full text-sleeper-bg bg-sleeper-teal hover:bg-sleeper-teal-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-sleeper-panel focus:ring-sleeper-teal transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh Data
              </button>
            )}
            {user !== undefined && <GoogleSignIn user={user ?? null} />}
          </div>
        </div>
      </div>
    </header>
  );
}
