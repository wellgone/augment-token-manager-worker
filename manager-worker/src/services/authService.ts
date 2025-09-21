import { Env, User, UserSession, LoginRequest } from '../types/index.js';
import {
  generateSessionToken,
  generateSessionId,
  hashPassword,
  parseUserCredentials,
  getSessionExpirationTime
} from '../utils/auth.js';

/**
 * Authentication service
 */
export class AuthService {
  constructor(private env: Env) {}

  /**
   * Authenticate user with username and password
   */
  async login(credentials: LoginRequest): Promise<{
    user: User;
    sessionToken: string;
    session: UserSession;
  }> {
    const { username, password } = credentials;

    // Check if user credentials are configured
    if (!this.env.USER_CREDENTIALS) {
      throw new Error('User authentication not configured. Please set USER_CREDENTIALS in your configuration.');
    }

    // Parse user credentials from environment variable
    const userCredentials = parseUserCredentials(this.env.USER_CREDENTIALS);

    // Check if user exists and password is correct
    const storedPassword = userCredentials.get(username);
    if (!storedPassword || storedPassword !== password) {
      throw new Error('Invalid credentials');
    }

    // Create user object
    const userId = `user-${username}`;
    const user: User = {
      id: userId,
      username,
      email: `${username}@example.com`,
      passwordHash: await hashPassword(password),
      role: username === 'admin' ? 'admin' : 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
    };

    // Generate session
    const sessionId = generateSessionId();
    const sessionToken = generateSessionToken();
    const expiresAt = getSessionExpirationTime(this.env.SESSION_EXPIRES_IN);

    const session: UserSession = {
      userId: user.id,
      sessionId,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      ipAddress: undefined, // Will be set by middleware
      userAgent: undefined, // Will be set by middleware
    };

    // Store session in KV with session token as key, include user data
    const sessionWithUser = {
      ...session,
      user: user // Include user data in session
    };

    await this.env.SESSIONS_KV.put(
      `session:${sessionToken}`,
      JSON.stringify(sessionWithUser),
      { expirationTtl: 24 * 60 * 60 } // 24 hours
    );

    return {
      user,
      sessionToken,
      session,
    };
  }



  /**
   * Logout user by invalidating session
   */
  async logout(sessionToken: string): Promise<void> {
    await this.env.SESSIONS_KV.delete(`session:${sessionToken}`);
  }

  /**
   * Get user by ID from USER_CREDENTIALS
   */
  async getUserById(userId: string): Promise<User | null> {
    if (!this.env.USER_CREDENTIALS) {
      return null;
    }

    const username = userId.replace('user-', '');
    const userCredentials = parseUserCredentials(this.env.USER_CREDENTIALS);

    if (!userCredentials.has(username)) {
      return null;
    }

    // Create user object from credentials
    const user: User = {
      id: userId,
      username,
      email: `${username}@example.com`,
      passwordHash: '', // Don't expose password hash
      role: username === 'admin' ? 'admin' : 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
    };

    return user;
  }

  /**
   * Get session by token (now includes user data)
   */
  async getSessionByToken(sessionToken: string): Promise<(UserSession & { user?: User }) | null> {
    const sessionData = await this.env.SESSIONS_KV.get(`session:${sessionToken}`);
    return sessionData ? JSON.parse(sessionData) : null;
  }

  /**
   * Validate session and return user
   */
  async validateSession(sessionToken: string): Promise<User | null> {
    const session = await this.getSessionByToken(sessionToken);
    if (!session) {
      return null;
    }

    // Check if session is expired
    if (new Date(session.expiresAt) < new Date()) {
      await this.logout(sessionToken);
      return null;
    }

    // Get user
    const user = await this.getUserById(session.userId);
    if (!user || !user.isActive) {
      return null;
    }

    return user;
  }

  // User management methods removed - users are managed via USER_CREDENTIALS environment variable
  // No need for createUser, updateUser, deleteUser, listUsers since users are hardcoded
}
