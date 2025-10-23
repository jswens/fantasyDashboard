// Simple in-memory session store
// In production, use Redis, database, or proper session management
const validSessions = new Set<string>();

// Track server startup to identify cold starts
const serverStartTime = new Date().toISOString();
console.log(`[AUTH] Session store initialized at ${serverStartTime}`);

export function addValidSession(sessionToken: string): void {
  console.log(`[AUTH] Adding session token: ${sessionToken.substring(0, 8)}...`);
  console.log(`[AUTH] Current valid sessions count: ${validSessions.size}`);
  
  validSessions.add(sessionToken);
  
  // Auto-expire sessions after 24 hours
  setTimeout(() => {
    console.log(`[AUTH] Auto-expiring session: ${sessionToken.substring(0, 8)}...`);
    validSessions.delete(sessionToken);
  }, 24 * 60 * 60 * 1000);
  
  console.log(`[AUTH] Session added. New count: ${validSessions.size}`);
}

export function validateSession(sessionToken: string): boolean {
  const isValid = validSessions.has(sessionToken);
  console.log(`[AUTH] Validating session: ${sessionToken.substring(0, 8)}... - Valid: ${isValid}`);
  console.log(`[AUTH] Current valid sessions count: ${validSessions.size}`);
  console.log(`[AUTH] Server start time: ${serverStartTime}`);
  
  if (!isValid) {
    console.log(`[AUTH] Session validation failed. Available sessions: ${Array.from(validSessions).map(s => s.substring(0, 8) + '...').join(', ')}`);
  }
  
  return isValid;
}

export function removeSession(sessionToken: string): void {
  console.log(`[AUTH] Removing session: ${sessionToken.substring(0, 8)}...`);
  validSessions.delete(sessionToken);
  console.log(`[AUTH] Session removed. Remaining count: ${validSessions.size}`);
}
