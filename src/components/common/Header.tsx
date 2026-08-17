import React from 'react';
import Link from 'next/link';
import { User } from 'firebase/auth';
import GoogleSignIn from '@/components/auth/GoogleSignIn';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  lastUpdated?: Date;
  onRefresh?: () => void;
  user?: User | null;
}

export default function Header({
  title = "Fantasy League Dashboard",
  subtitle,
  lastUpdated,
  onRefresh,
  user,
}: HeaderProps) {
  return (
    <header className="bg-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-6">
          <div className="flex items-center space-x-8">
            <div>
              <Link href="/" className="text-3xl font-bold text-gray-900 hover:text-blue-600">
                {title}
              </Link>
              {subtitle && (
                <p className="text-gray-600 mt-1">{subtitle}</p>
              )}
              {lastUpdated && (
                <p className="text-sm text-gray-500 mt-1">
                  Last updated: {lastUpdated.toLocaleString()}
                </p>
              )}
            </div>

            {/* Navigation Links */}
            <nav className="hidden md:flex space-x-6">
              <Link
                href="/"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Dashboard
              </Link>
              <Link
                href="/free-agents"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium inline-flex items-center"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Free Agents
              </Link>
              <Link
                href="/players"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Players
              </Link>
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
