import type { NextApiRequest, NextApiResponse } from 'next';
import { addValidSession } from '@/lib/auth/persistent-sessions';

interface AuthRequest {
  password: string;
}

interface AuthResponse {
  success: boolean;
  sessionToken?: string;
  message: string;
}

// Rate limiting storage (in memory for simplicity)
const rateLimitMap = new Map<string, { attempts: number; lastAttempt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 5;

  const record = rateLimitMap.get(ip);
  
  if (!record) {
    rateLimitMap.set(ip, { attempts: 1, lastAttempt: now });
    return true;
  }

  // Reset if window has expired
  if (now - record.lastAttempt > windowMs) {
    rateLimitMap.set(ip, { attempts: 1, lastAttempt: now });
    return true;
  }

  // Check if within limits
  if (record.attempts >= maxAttempts) {
    return false;
  }

  // Increment attempts
  record.attempts++;
  record.lastAttempt = now;
  return true;
}

function generateSessionToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<AuthResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  // Get client IP for rate limiting
  const clientIp = (req.headers['x-forwarded-for'] as string) || 
                   (req.connection.remoteAddress as string) || 
                   'unknown';

  // Check rate limit
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({
      success: false,
      message: 'Too many attempts. Please try again in 15 minutes.'
    });
  }

  const { password }: AuthRequest = req.body;

  if (!password) {
    return res.status(400).json({
      success: false,
      message: 'Password is required'
    });
  }

  // Get password from environment variable (not in source control)
  const validPassword = process.env.ADMIN_PASSWORD;

  if (!validPassword) {
    console.error('ADMIN_PASSWORD environment variable not set');
    return res.status(500).json({
      success: false,
      message: 'Server configuration error'
    });
  }

  if (password !== validPassword) {
    return res.status(401).json({
      success: false,
      message: 'Invalid password'
    });
  }

  // Generate simple session token
  const sessionToken = generateSessionToken();
  
  console.log(`[AUTH] Login successful for IP: ${clientIp}`);
  console.log(`[AUTH] Generated session token: ${sessionToken.substring(0, 8)}...`);

  // Store session for validation
  addValidSession(sessionToken);

  return res.status(200).json({
    success: true,
    sessionToken,
    message: 'Authentication successful'
  });
}
