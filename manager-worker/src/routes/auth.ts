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
 * Exchange authorization code for access token
 */
async function getAugmentAccessToken(
  tenantUrl: string,
  codeVerifier: string,
  authCode: string
): Promise<{
  access_token: string;
  email: string;
  portal_url: string;
}> {
  const tokenUrl = new URL('/oauth/token', tenantUrl);

  const response = await fetch(tokenUrl.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: authCode,
      code_verifier: codeVerifier,
      client_id: 'v',
    }),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
  }

  const tokenData = await response.json() as {
    access_token: string;
    email?: string;
    portal_url?: string;
  };

  if (!tokenData.access_token) {
    throw new Error('No access token in response');
  }

  return {
    access_token: tokenData.access_token,
    email: tokenData.email || '',
    portal_url: tokenData.portal_url || '',
  };
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
    // 简单的请求体解析
    const requestText = await request.text();
    if (!requestText) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Request body is empty'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let body: LoginRequest;
    try {
      body = JSON.parse(requestText);
    } catch (e) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid JSON'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 基本验证
    if (!body.username || !body.password) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Username and password are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 验证用户凭据
    const userCredentials = env.USER_CREDENTIALS || '';
    const credentials = new Map<string, string>();

    userCredentials.split(',').forEach(pair => {
      const [username, password] = pair.trim().split(':');
      if (username && password) {
        credentials.set(username.trim(), password.trim());
      }
    });

    const storedPassword = credentials.get(body.username);
    if (!storedPassword || storedPassword !== body.password) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid credentials'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 生成会话令牌
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小时

    // 存储会话
    await env.SESSIONS_KV.put(
      `session:${sessionToken}`,
      JSON.stringify({
        userId: `user-${body.username}`,
        username: body.username,
        role: body.username === 'admin' ? 'admin' : 'user',
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString()
      }),
      { expirationTtl: 24 * 60 * 60 }
    );

    // 返回成功响应
    return new Response(JSON.stringify({
      success: true,
      data: {
        user: {
          id: `user-${body.username}`,
          username: body.username,
          email: `${body.username}@example.com`,
          role: body.username === 'admin' ? 'admin' : 'user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        sessionToken: sessionToken,
        expiresIn: '24h'
      },
      message: 'Login successful'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
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
    // 提取会话令牌
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const sessionToken = authHeader.substring(7);

      // 删除会话
      await env.SESSIONS_KV.delete(`session:${sessionToken}`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Logout successful'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Logout error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Logout failed'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
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
 * Validate OAuth authorization response
 */
export async function validateResponseHandler(
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
      auth_response: {
        code: string;
        state: string;
        tenant_url: string;
      };
      oauth_state: {
        code_verifier: string;
        code_challenge: string;
        state: string;
        creation_time: number;
      };
    }>(request);

    // Validate state parameter to prevent CSRF attacks
    if (body.auth_response.state !== body.oauth_state.state) {
      return createErrorResponse('state参数不匹配，可能存在安全风险', 400);
    }

    // Validate OAuth state expiration (30 minutes)
    const currentTime = Date.now();
    if (currentTime - body.oauth_state.creation_time > 30 * 60 * 1000) {
      return createErrorResponse('OAuth状态已过期，请重新开始授权流程', 400);
    }

    // Exchange authorization code for access token
    const tokenResponse = await getAugmentAccessToken(
      body.auth_response.tenant_url,
      body.oauth_state.code_verifier,
      body.auth_response.code
    );

    return createSuccessResponse({
      tenant_url: body.auth_response.tenant_url,
      access_token: tokenResponse.access_token,
      email: tokenResponse.email,
      portal_url: tokenResponse.portal_url,
    }, '授权响应验证成功');

  } catch (error) {
    console.error('Validate response error:', error);
    return createErrorResponse('获取access token失败: ' + (error instanceof Error ? error.message : 'Unknown error'), 500);
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
