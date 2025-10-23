import fs from 'fs';
import path from 'path';

interface Session {
  token: string;
  createdAt: string;
  expiresAt: string;
}

interface SessionStore {
  sessions: Session[];
  lastCleanup: string;
}

const SESSION_FILE = path.join(process.cwd(), 'data', 'sessions.json');
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours in ms
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour in ms

// Ensure data directory exists
function ensureDataDirectory(): void {
  const dataDir = path.dirname(SESSION_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Load sessions from file
function loadSessions(): SessionStore {
  try {
    ensureDataDirectory();
    
    if (!fs.existsSync(SESSION_FILE)) {
      return { sessions: [], lastCleanup: new Date().toISOString() };
    }
    
    const data = fs.readFileSync(SESSION_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[PERSISTENT_AUTH] Error loading sessions:', error);
    return { sessions: [], lastCleanup: new Date().toISOString() };
  }
}

// Save sessions to file
function saveSessions(store: SessionStore): void {
  try {
    ensureDataDirectory();
    fs.writeFileSync(SESSION_FILE, JSON.stringify(store, null, 2));
  } catch (error) {
    console.error('[PERSISTENT_AUTH] Error saving sessions:', error);
  }
}

// Clean up expired sessions
function cleanupExpiredSessions(store: SessionStore): SessionStore {
  const now = new Date();
  const validSessions = store.sessions.filter(session => 
    new Date(session.expiresAt) > now
  );
  
  const cleanedStore = {
    sessions: validSessions,
    lastCleanup: now.toISOString()
  };
  
  if (validSessions.length !== store.sessions.length) {
    console.log(`[PERSISTENT_AUTH] Cleaned up ${store.sessions.length - validSessions.length} expired sessions`);
    saveSessions(cleanedStore);
  }
  
  return cleanedStore;
}

// Should we perform cleanup?
function shouldCleanup(lastCleanup: string): boolean {
  const now = new Date().getTime();
  const lastCleanupTime = new Date(lastCleanup).getTime();
  return (now - lastCleanupTime) > CLEANUP_INTERVAL;
}

export function addValidSession(sessionToken: string): void {
  console.log(`[PERSISTENT_AUTH] Adding session token: ${sessionToken.substring(0, 8)}...`);
  
  let store = loadSessions();
  
  // Cleanup if needed
  if (shouldCleanup(store.lastCleanup)) {
    store = cleanupExpiredSessions(store);
  }
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION);
  
  const newSession: Session = {
    token: sessionToken,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString()
  };
  
  // Remove any existing session with the same token (shouldn't happen, but just in case)
  store.sessions = store.sessions.filter(s => s.token !== sessionToken);
  
  // Add new session
  store.sessions.push(newSession);
  
  console.log(`[PERSISTENT_AUTH] Session added. Total active sessions: ${store.sessions.length}`);
  console.log(`[PERSISTENT_AUTH] Session expires at: ${expiresAt.toISOString()}`);
  
  saveSessions(store);
}

export function validateSession(sessionToken: string): boolean {
  console.log(`[PERSISTENT_AUTH] Validating session: ${sessionToken.substring(0, 8)}...`);
  
  let store = loadSessions();
  
  // Cleanup if needed
  if (shouldCleanup(store.lastCleanup)) {
    store = cleanupExpiredSessions(store);
  }
  
  const now = new Date();
  const session = store.sessions.find(s => 
    s.token === sessionToken && new Date(s.expiresAt) > now
  );
  
  const isValid = !!session;
  
  console.log(`[PERSISTENT_AUTH] Session validation result: ${isValid}`);
  console.log(`[PERSISTENT_AUTH] Total active sessions: ${store.sessions.length}`);
  
  if (!isValid) {
    const availableTokens = store.sessions
      .filter(s => new Date(s.expiresAt) > now)
      .map(s => s.token.substring(0, 8) + '...')
      .join(', ');
    console.log(`[PERSISTENT_AUTH] Available valid sessions: ${availableTokens || 'NONE'}`);
  } else if (session) {
    console.log(`[PERSISTENT_AUTH] Session expires at: ${session.expiresAt}`);
  }
  
  return isValid;
}

export function removeSession(sessionToken: string): void {
  console.log(`[PERSISTENT_AUTH] Removing session: ${sessionToken.substring(0, 8)}...`);
  
  const store = loadSessions();
  const initialCount = store.sessions.length;
  
  store.sessions = store.sessions.filter(s => s.token !== sessionToken);
  
  console.log(`[PERSISTENT_AUTH] Session removed. Remaining sessions: ${store.sessions.length}`);
  
  if (store.sessions.length !== initialCount) {
    saveSessions(store);
  }
}

// Export cleanup function for manual cleanup if needed
export function cleanupSessions(): void {
  console.log('[PERSISTENT_AUTH] Manual session cleanup triggered');
  const store = loadSessions();
  cleanupExpiredSessions(store);
}