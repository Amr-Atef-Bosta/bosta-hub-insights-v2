import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { MongoClient } from 'mongodb';
import { logger } from '../utils/logger.js';

// Organizational unit to role mapping
const ORG_UNIT_ROLE_MAPPING: Record<string, string> = {
  'EXECUTIVES_MEMBER': 'admin',
  'ENGINEERING_DEVELOPER': 'admin',
  'ACCOUNT_MANAGEMENT_MEMBER': 'am',
  'ACCOUNT_MANAGEMENT_MANAGER': 'am',
  'FINANCE_REVENUE_SUPERVISOR': 'analyst',
  'OPERATIONS_DIRECTOR': 'leader',
  'DEFAULT_ANALYST': 'analyst'
};

// Allowed domains
const ALLOWED_DOMAINS = ['bosta.co', 'bosta.email'];

export class GoogleOAuthService {
  private oauth2Client: OAuth2Client | null = null;

  constructor() {
    // Remove initialization from constructor
    // OAuth2Client will be initialized lazily when needed
  }

  private initializeOAuth2Client(): OAuth2Client {
    if (!this.oauth2Client) {
      // Validate required environment variables
      const requiredVars = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'];
      const missingVars = requiredVars.filter(varName => !process.env[varName] || process.env[varName]?.includes('your_'));
      
      if (missingVars.length > 0) {
        logger.warn(`Missing Google OAuth configuration: ${missingVars.join(', ')}`);
        throw new Error(`Missing Google OAuth configuration: ${missingVars.join(', ')}`);
      }

      this.oauth2Client = new OAuth2Client(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );
    }

    return this.oauth2Client;
  }

  /**
   * Generate Google OAuth authorization URL
   */
  getAuthUrl(): string {
    const oauth2Client = this.initializeOAuth2Client();

    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      hd: process.env.GOOGLE_DOMAIN, // Restrict to organization domain
      prompt: 'consent'
    });

    return authUrl;
  }

  /**
   * Check if Google OAuth is properly configured
   */
  isConfigured(): boolean {
    return !!(
      process.env.GOOGLE_CLIENT_ID && 
      !process.env.GOOGLE_CLIENT_ID.includes('your_') &&
      process.env.GOOGLE_CLIENT_SECRET && 
      !process.env.GOOGLE_CLIENT_SECRET.includes('your_') &&
      process.env.GOOGLE_REDIRECT_URI &&
      !process.env.GOOGLE_REDIRECT_URI.includes('your_')
    );
  }

  /**
   * Exchange authorization code for tokens and get user info
   */
  async getTokensAndUserInfo(code: string) {
    const oauth2Client = this.initializeOAuth2Client();

    try {
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      // Get user basic info
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client as any });
      const { data: userInfo } = await oauth2.userinfo.get();

      if (!userInfo.email || !this.isAllowedDomain(userInfo.email)) {
        throw new Error('User must belong to an authorized domain (@bosta.co or @bosta.email)');
      }

      // Check hosted domain (hd parameter) for additional security
      if (userInfo.hd && !ALLOWED_DOMAINS.includes(userInfo.hd)) {
        throw new Error(`User must belong to an authorized domain. Current domain: ${userInfo.hd}`);
      }

      // Get user role from MongoDB
      const { orgUnit, role } = await this.getUserRoleFromMongo(userInfo.email);

      logger.auth(`User authenticated successfully: ${userInfo.email} -> ${role}`);

      return {
        googleId: userInfo.id,
        email: userInfo.email,
        name: userInfo.name || userInfo.email.split('@')[0],
        avatarUrl: userInfo.picture,
        orgUnit,
        role,
        hostedDomain: userInfo.hd,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token
      };
    } catch (error) {
      logger.error('Google OAuth error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to authenticate with Google');
    }
  }

  /**
   * Get user role from MongoDB users collection
   * Looks up user by email and checks adminGroup.name field
   */
  private async getUserRoleFromMongo(email: string): Promise<{ orgUnit: string; role: string }> {
    let client: MongoClient | null = null;
    
    try {
      // Connect to MongoDB
      if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI environment variable is not set');
      }
      
      client = new MongoClient(process.env.MONGODB_URI);
      await client.connect();
      
      const db = client.db();
      const usersCollection = db.collection('users');
      
      // Find user by email
      const user = await usersCollection.findOne(
        { 'emails.address': email }, 
        { projection: { adminGroup: 1 } }
      );
      
      if (user && user.adminGroup && user.adminGroup.name) {
        const adminGroupName = user.adminGroup.name;
        
        // Check if adminGroup.name exists in our mapping
        if (ORG_UNIT_ROLE_MAPPING[adminGroupName]) {
          const role = ORG_UNIT_ROLE_MAPPING[adminGroupName];
          logger.auth(`Role mapped: ${adminGroupName} -> ${role}`);
          return { orgUnit: adminGroupName, role };
        } else {
          logger.warn(`AdminGroup.name ${adminGroupName} not found in mapping, using default role 'am'`);
          return { orgUnit: adminGroupName, role: 'am' };
        }
      } else {
        logger.warn(`No adminGroup.name found for ${email}, using default role 'am'`);
        return { orgUnit: 'DEFAULT_AM', role: 'am' };
      }
    } catch (error) {
      logger.error(`Error getting user role from MongoDB for ${email}:`, error);
      return { orgUnit: 'DEFAULT_AM', role: 'am' };
    } finally {
      if (client) {
        await client.close();
      }
    }
  }

  /**
   * Check if email domain is allowed
   */
  private isAllowedDomain(email: string): boolean {
    return ALLOWED_DOMAINS.some(domain => email.endsWith(`@${domain}`));
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string) {
    const oauth2Client = this.initializeOAuth2Client();

    try {
      oauth2Client.setCredentials({
        refresh_token: refreshToken
      });

      const { credentials } = await oauth2Client.refreshAccessToken();
      return credentials.access_token;
    } catch (error) {
      logger.error('Token refresh error:', error);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Verify Google access token
   */
  async verifyAccessToken(accessToken: string) {
    const oauth2Client = this.initializeOAuth2Client();

    try {
      const ticket = await oauth2Client.verifyIdToken({
        idToken: accessToken,
        audience: process.env.GOOGLE_CLIENT_ID
      });

      const payload = ticket.getPayload();
      return payload;
    } catch (error) {
      logger.error('Token verification error:', error);
      return null;
    }
  }
}

export const googleOAuthService = new GoogleOAuthService();