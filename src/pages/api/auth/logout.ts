import type { NextApiRequest, NextApiResponse } from 'next';
import { removeSession, validateSession } from '@/lib/auth/persistent-sessions';

interface LogoutResponse {
  success: boolean;
  message: string;
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<LogoutResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  // Get session token from header
  const sessionToken = req.headers.authorization?.replace('Bearer ', '');
  
  if (!sessionToken) {
    return res.status(400).json({
      success: false,
      message: 'No session token provided'
    });
  }

  console.log(`[LOGOUT] Logout request for session: ${sessionToken.substring(0, 8)}...`);

  // Validate session exists before removing (optional check)
  const isValid = validateSession(sessionToken);
  
  if (isValid) {
    // Remove the session
    removeSession(sessionToken);
    console.log(`[LOGOUT] Session successfully removed: ${sessionToken.substring(0, 8)}...`);
    
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } else {
    console.log(`[LOGOUT] Session was already invalid: ${sessionToken.substring(0, 8)}...`);
    
    // Still return success since the goal (user not authenticated) is achieved
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully (session was already invalid)'
    });
  }
}