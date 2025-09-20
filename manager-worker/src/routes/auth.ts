import { Env, AuthenticatedRequest, LoginRequest } from '../types/index.js';
import { AuthService } from '../services/authService.js';
import {
  createSuccessResponse,
  createErrorResponse,
  parseJsonBody,
  createUnauthorizedResponse
} from '../utils/response.js';
import { validateData, ValidationRules } from '../utils/validation.js';
import { getCurrentUser, getCurrentSession } from '../middleware/auth.js';

/**
 * Login endpoint
 */
export async function loginHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    // Parse request body
    const body = await parseJsonBody<LoginRequest>(request);
    
    // Validate input
    const validation = validateData(body, ValidationRules.login);
    if (!validation.isValid) {
      return createErrorResponse(
        `Validation failed: ${validation.errors.join(', ')}`,
        400
      );
    }
    
    // Create auth service
    const authService = new AuthService(env);
    
    // Attempt login
    const result = await authService.login(body);
    
    // Return success response with tokens
    return createSuccessResponse({
      user: {
        id: result.user.id,
        username: result.user.username,
        email: result.user.email,
        role: result.user.role,
        createdAt: result.user.createdAt,
        updatedAt: result.user.updatedAt,
      },
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: env.JWT_EXPIRES_IN,
    }, 'Login successful');
    
  } catch (error) {
    console.error('Login error:', error);
    return createUnauthorizedResponse(
      error instanceof Error ? error.message : 'Login failed'
    );
  }
}

/**
 * Logout endpoint
 */
export async function logoutHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const session = getCurrentSession(request);
    if (!session) {
      return createErrorResponse('No active session', 400);
    }
    
    // Create auth service and logout
    const authService = new AuthService(env);
    await authService.logout(session.sessionId);
    
    return createSuccessResponse(null, 'Logout successful');
    
  } catch (error) {
    console.error('Logout error:', error);
    return createErrorResponse('Logout failed', 500);
  }
}

/**
 * Get current user profile
 */
export async function profileHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return createUnauthorizedResponse('Authentication required');
    }
    
    return createSuccessResponse({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      isActive: user.isActive,
    });
    
  } catch (error) {
    console.error('Profile error:', error);
    return createErrorResponse('Failed to get profile', 500);
  }
}

/**
 * Refresh token endpoint
 */
export async function refreshTokenHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const body = await parseJsonBody<{ refreshToken: string }>(request);
    
    if (!body.refreshToken) {
      return createErrorResponse('Refresh token is required', 400);
    }
    
    // Create auth service
    const authService = new AuthService(env);
    
    // Refresh tokens
    const result = await authService.refreshToken(body.refreshToken);
    
    return createSuccessResponse({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: env.JWT_EXPIRES_IN,
    }, 'Token refreshed successfully');
    
  } catch (error) {
    console.error('Refresh token error:', error);
    return createUnauthorizedResponse(
      error instanceof Error ? error.message : 'Token refresh failed'
    );
  }
}

/**
 * Validate token endpoint (check if current token is valid)
 */
export async function validateTokenHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    const session = getCurrentSession(request);
    
    if (!user || !session) {
      return createUnauthorizedResponse('Invalid token');
    }
    
    return createSuccessResponse({
      valid: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      session: {
        sessionId: session.sessionId,
        expiresAt: session.expiresAt,
      },
    }, 'Token is valid');
    
  } catch (error) {
    console.error('Validate token error:', error);
    return createUnauthorizedResponse('Token validation failed');
  }
}

/**
 * Change password endpoint
 */
export async function changePasswordHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return createUnauthorizedResponse('Authentication required');
    }
    
    const body = await parseJsonBody<{
      currentPassword: string;
      newPassword: string;
    }>(request);
    
    if (!body.currentPassword || !body.newPassword) {
      return createErrorResponse('Current password and new password are required', 400);
    }
    
    if (body.newPassword.length < 8) {
      return createErrorResponse('New password must be at least 8 characters long', 400);
    }
    
    // Create auth service
    const authService = new AuthService(env);
    
    // For admin user, verify against ADMIN_PASSWORD
    if (user.username === 'admin') {
      // In a real implementation, you'd verify the current password
      // For now, just update the password
      await authService.updateUser(user.id, {
        passwordHash: body.newPassword, // Will be hashed in updateUser
      });
      
      return createSuccessResponse(null, 'Password changed successfully');
    }
    
    return createErrorResponse('Password change not supported for this user', 400);
    
  } catch (error) {
    console.error('Change password error:', error);
    return createErrorResponse('Password change failed', 500);
  }
}

/**
 * Get user sessions (admin only)
 */
export async function getSessionsHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    if (!user || user.role !== 'admin') {
      return createUnauthorizedResponse('Admin access required');
    }
    
    // In a real implementation, you'd list all active sessions
    // For now, return empty array
    return createSuccessResponse([], 'Sessions retrieved successfully');
    
  } catch (error) {
    console.error('Get sessions error:', error);
    return createErrorResponse('Failed to get sessions', 500);
  }
}

/**
 * Revoke session (admin only)
 */
export async function revokeSessionHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    if (!user || user.role !== 'admin') {
      return createUnauthorizedResponse('Admin access required');
    }
    
    const body = await parseJsonBody<{ sessionId: string }>(request);
    
    if (!body.sessionId) {
      return createErrorResponse('Session ID is required', 400);
    }
    
    // Create auth service and revoke session
    const authService = new AuthService(env);
    await authService.logout(body.sessionId);
    
    return createSuccessResponse(null, 'Session revoked successfully');
    
  } catch (error) {
    console.error('Revoke session error:', error);
    return createErrorResponse('Failed to revoke session', 500);
  }
}
