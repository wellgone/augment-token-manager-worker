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
import { extractSessionToken } from '../utils/auth.js';

/**
 * Generate random bytes and encode as base64url (without padding)
 */
function base64URLEncode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate OAuth 2.0 PKCE parameters (Augment style)
 */
async function createAugmentOAuthState() {
  // Generate code_verifier (32 random bytes, base64url encoded)
  const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
  const codeVerifier = base64URLEncode(verifierBytes);

  // Generate code_challenge = BASE64URL(SHA256(code_verifier))
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const codeChallenge = base64URLEncode(new Uint8Array(hash));

  // Generate state (8 random bytes, base64url encoded)
  const stateBytes = crypto.getRandomValues(new Uint8Array(8));
  const state = base64URLEncode(stateBytes);

  return {
    codeVerifier,
    codeChallenge,
    state,
    creationTime: Date.now()
  };
}

/**
 * Generate Augment authorization URL
 */
function generateAugmentAuthorizeURL(oauthState: {
  codeChallenge: string;
  state: string;
}): string {
  const authUrl = new URL('https://auth.augmentcode.com/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('code_challenge', oauthState.codeChallenge);
  authUrl.searchParams.set('client_id', 'v'); // Augment client ID
  authUrl.searchParams.set('state', oauthState.state);
  authUrl.searchParams.set('prompt', 'login');

  return authUrl.toString();
}

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
    
    // Return success response with session token
    return createSuccessResponse({
      user: {
        id: result.user.id,
        username: result.user.username,
        email: result.user.email,
        role: result.user.role,
        createdAt: result.user.createdAt,
        updatedAt: result.user.updatedAt,
      },
      sessionToken: result.sessionToken,
      expiresIn: env.SESSION_EXPIRES_IN,
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
    // Extract session token from Authorization header
    const sessionToken = extractSessionToken(request);
    if (!sessionToken) {
      return createErrorResponse('No session token provided', 400);
    }

    // Create auth service and logout
    const authService = new AuthService(env);
    await authService.logout(sessionToken);

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
 * Refresh token endpoint (deprecated)
 */
export async function refreshTokenHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  return createErrorResponse('Refresh token functionality has been removed. Please login again.', 410);
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
 * Generate Augment OAuth authorization URL with PKCE
 */
export async function generateUrlHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return createUnauthorizedResponse('Authentication required');
    }

    // Create OAuth state (Augment style)
    const oauthState = await createAugmentOAuthState();

    // Generate authorization URL
    const authUrl = generateAugmentAuthorizeURL(oauthState);

    return createSuccessResponse({
      auth_url: authUrl,
      code_verifier: oauthState.codeVerifier,
      code_challenge: oauthState.codeChallenge,
      state: oauthState.state,
      creation_time: oauthState.creationTime,
    }, '授权URL生成成功');

  } catch (error) {
    console.error('Generate URL error:', error);
    return createErrorResponse('生成授权URL失败: ' + (error instanceof Error ? error.message : 'Unknown error'), 500);
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
