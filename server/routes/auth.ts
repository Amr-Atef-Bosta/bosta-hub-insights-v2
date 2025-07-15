import express from 'express';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../database/init.js';
import { googleOAuthService } from '../services/googleOAuthService.js';
import { authenticateToken } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Check if dev login is available
router.get('/dev-available', (req, res) => {
  const isDevAvailable = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'staging';
  res.json({ available: isDevAvailable });
});

// Development login endpoint
router.post('/dev-login', async (req, res) => {
  // Only allow in development mode
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Development login not available in this environment' });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Only allow the specific development email
    const allowedEmail = 'fadymazz@gmail.com';
    
    if (email !== allowedEmail) {
      return res.status(400).json({ error: 'User credentials are invalid' });
    }

    // Create or get user for development
    const db = getDatabase();
    
    // Try to find existing user
    let [rows] = await db.execute(
      'SELECT id, email, name, role, avatar_url FROM users WHERE email = ?',
      [email]
    );

    let user = (rows as any[])[0];

    if (!user) {
      // Create new user for development
      const userId = `dev_${Date.now()}`;
      const name = email.split('@')[0].replace('.', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
      
      // Determine role based on email or default to 'am'
      let role = 'admin';
      // if (email.includes('admin') || email.includes('leader')) {
      //   role = 'leader';
      // } else if (email.includes('analyst')) {
      //   role = 'analyst';
      // }

      await db.execute(
        'INSERT INTO users (id, email, name, role, auth_provider, org_unit) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, email, name, role, 'google', 'ENGINEERING_DEVELOPER']
      );

      user = {
        id: userId,
        email,
        name,
        role,
        avatar_url: null,
        orgUnit: 'ENGINEERING_DEVELOPER'
      };
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        orgUnit: user.org_unit || 'ENGINEERING_DEVELOPER'
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        orgUnit: user.org_unit || 'ENGINEERING_DEVELOPER',
        avatar_url: user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=6366f1&color=fff`
      }
    });

    logger.info(`Development login successful for: ${email}`);
  } catch (error) {
    logger.error('Development login error:', error);
    res.status(500).json({ error: 'Development login failed' });
  }
});

// Google OAuth login initiation
router.get('/google', async (req, res) => {
  try {
    if (!googleOAuthService.isConfigured()) {
      logger.error('Google OAuth is not properly configured');
      return res.status(500).json({
        error: 'Google OAuth is not configured. Please check your environment variables.'
      });
    }

    const authUrl = googleOAuthService.getAuthUrl();

    res.redirect(authUrl);
  } catch (error) {
    logger.error('Error generating Google OAuth URL:', error);
    res.status(500).json({ error: 'Failed to generate OAuth URL' });
  }
});

// Google OAuth callback
router.get('/google/callback', async (req, res) => {
  try {
    const { code, error } = req.query;

    // if (error) {
    //   logger.error('OAuth error from Google:', error);
    //   return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback?error=oauth_error`);
    // }

    if (!code) {
      logger.error('No authorization code received');
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback?error=missing_code`);
    }

    const userInfo = await googleOAuthService.getTokensAndUserInfo(code as string);

    const token = jwt.sign(
      {
        userId: userInfo.googleId,
        email: userInfo.email,
        role: userInfo.role,
        orgUnit: userInfo.orgUnit
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    const user = {
      id: userInfo.googleId,
      email: userInfo.email,
      name: userInfo.name,
      avatarUrl: userInfo.avatarUrl,
      role: userInfo.role,
      orgUnit: userInfo.orgUnit
    };

    // Redirect to frontend with token and user data
    const userParam = encodeURIComponent(JSON.stringify(user));
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback?token=${token}&user=${userParam}`);
  } catch (error) {
    logger.error('OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/callback?error=oauth_failed`);
  }
});

// Google OAuth callback (POST - for API usage)
router.post('/google/callback', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    const userInfo = await googleOAuthService.getTokensAndUserInfo(code);

    const token = jwt.sign(
      {
        userId: userInfo.googleId,
        email: userInfo.email,
        role: userInfo.role,
        orgUnit: userInfo.orgUnit
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: userInfo.googleId,
        email: userInfo.email,
        name: userInfo.name,
        avatarUrl: userInfo.avatarUrl,
        role: userInfo.role,
        orgUnit: userInfo.orgUnit
      }
    });
  } catch (error) {
    logger.error('OAuth callback error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Authentication failed' });
  }
});

// Verify token
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;

    const db = getDatabase();
    const [rows] = await db.execute(
      'SELECT id, email, name, role, avatar_url, auth_provider, org_unit FROM users WHERE id = ?',
      [decoded.userId]
    );

    const user = (rows as any[])[0];

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar_url: user.avatar_url || null,
      }
    });
  } catch (error) {
    logger.error('Token verification error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Get current user info
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const newAccessToken = await googleOAuthService.refreshAccessToken(refreshToken);

    res.json({ accessToken: newAccessToken });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(401).json({ error: 'Failed to refresh token' });
  }
});

// Logout endpoint
router.post('/logout', authenticateToken, (req, res) => {
  // In a real application, you might want to blacklist the token
  res.json({ message: 'Logged out successfully' });
});

export default router;
