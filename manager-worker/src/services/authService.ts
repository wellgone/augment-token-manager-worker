import { Env, User, UserSession, LoginRequest } from '../types/index.js';
import {
  generateSessionToken,
  generateSessionId,
  hashPassword,
  verifyPassword,
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

    // Parse user credentials from environment variable
    const userCredentials = parseUserCredentials(this.env.USER_CREDENTIALS || '');

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

    // Store session in KV with session token as key
    await this.env.SESSIONS_KV.put(
      `session:${sessionToken}`,
      JSON.stringify(session),
      { expirationTtl: 24 * 60 * 60 } // 24 hours
    );

    // Store user in KV (for session validation)
    await this.env.USERS_KV.put(
      `user:${user.id}`,
      JSON.stringify(user),
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
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    const userData = await this.env.USERS_KV.get(`user:${userId}`);
    return userData ? JSON.parse(userData) : null;
  }

  /**
   * Get session by token
   */
  async getSessionByToken(sessionToken: string): Promise<UserSession | null> {
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

  /**
   * Create a new user (admin only)
   */
  async createUser(userData: {
    username: string;
    password: string;
    email?: string;
    role: 'admin' | 'user';
  }): Promise<User> {
    const userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const passwordHash = await hashPassword(userData.password);
    
    const user: User = {
      id: userId,
      username: userData.username,
      email: userData.email,
      passwordHash,
      role: userData.role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
    };
    
    // Store user in KV
    await this.env.USERS_KV.put(`user:${userId}`, JSON.stringify(user));
    
    return user;
  }

  /**
   * Update user
   */
  async updateUser(userId: string, updates: Partial<User>): Promise<User | null> {
    const user = await this.getUserById(userId);
    if (!user) {
      return null;
    }
    
    const updatedUser: User = {
      ...user,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    
    // If password is being updated, hash it
    if (updates.passwordHash) {
      updatedUser.passwordHash = await hashPassword(updates.passwordHash);
    }
    
    await this.env.USERS_KV.put(`user:${userId}`, JSON.stringify(updatedUser));
    
    return updatedUser;
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string): Promise<boolean> {
    const user = await this.getUserById(userId);
    if (!user) {
      return false;
    }
    
    await this.env.USERS_KV.delete(`user:${userId}`);
    return true;
  }

  /**
   * List all users (admin only)
   */
  async listUsers(): Promise<User[]> {
    // KV doesn't support listing all keys easily
    // In a real implementation, you'd use D1 database or maintain an index
    // For now, return empty array
    return [];
  }
}
