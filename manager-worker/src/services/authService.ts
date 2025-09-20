import { Env, User, UserSession, LoginRequest } from '../types/index.js';
import {
  generateAccessToken,
  generateRefreshToken,
  generateSessionId,
  hashPassword,
  verifyPassword
} from '../utils/jwt.js';

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
    accessToken: string;
    refreshToken: string;
    session: UserSession;
  }> {
    // For demo purposes, we'll use a hardcoded admin user
    // In production, this would query a database
    const { username, password } = credentials;
    
    // Check if it's the admin user
    if (username === 'admin') {
      const isValidPassword = await this.verifyAdminPassword(password);
      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }
      
      // Create admin user object
      const user: User = {
        id: 'admin-user-id',
        username: 'admin',
        email: 'admin@example.com',
        passwordHash: await hashPassword(this.env.ADMIN_PASSWORD),
        role: 'admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
      };
      
      // Generate session
      const sessionId = generateSessionId();
      const session: UserSession = {
        userId: user.id,
        sessionId,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        ipAddress: undefined, // Will be set by middleware
        userAgent: undefined, // Will be set by middleware
      };
      
      // Generate tokens
      const accessToken = await generateAccessToken(
        {
          sub: user.id,
          username: user.username,
          role: user.role,
          sessionId,
        },
        this.env.JWT_SECRET,
        this.env.JWT_EXPIRES_IN
      );
      
      const refreshToken = await generateRefreshToken(
        {
          sub: user.id,
          sessionId,
        },
        this.env.JWT_SECRET,
        this.env.REFRESH_TOKEN_EXPIRES_IN
      );
      
      // Store session in KV
      await this.env.SESSIONS_KV.put(
        `session:${sessionId}`,
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
        accessToken,
        refreshToken,
        session,
      };
    }
    
    // For other users, you would implement database lookup here
    throw new Error('User not found');
  }

  /**
   * Verify admin password
   */
  private async verifyAdminPassword(password: string): Promise<boolean> {
    return verifyPassword(password, await hashPassword(this.env.ADMIN_PASSWORD));
  }

  /**
   * Logout user by invalidating session
   */
  async logout(sessionId: string): Promise<void> {
    await this.env.SESSIONS_KV.delete(`session:${sessionId}`);
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    // This would be implemented with proper refresh token validation
    // For now, return error
    throw new Error('Refresh token functionality not implemented');
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    const userData = await this.env.USERS_KV.get(`user:${userId}`);
    return userData ? JSON.parse(userData) : null;
  }

  /**
   * Get session by ID
   */
  async getSessionById(sessionId: string): Promise<UserSession | null> {
    const sessionData = await this.env.SESSIONS_KV.get(`session:${sessionId}`);
    return sessionData ? JSON.parse(sessionData) : null;
  }

  /**
   * Validate session and return user
   */
  async validateSession(sessionId: string): Promise<User | null> {
    const session = await this.getSessionById(sessionId);
    if (!session) {
      return null;
    }
    
    // Check if session is expired
    if (new Date(session.expiresAt) < new Date()) {
      await this.logout(sessionId);
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
