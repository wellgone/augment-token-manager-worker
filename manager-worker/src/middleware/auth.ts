import { Env, AuthenticatedRequest, User, UserSession } from '../types/index.js';
import { extractSessionToken } from '../utils/auth.js';
import { createUnauthorizedResponse, createForbiddenResponse } from '../utils/response.js';
import { AuthService } from '../services/authService.js';

/**
 * Session Authentication middleware
 */
export async function authMiddleware(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response | null> {
  try {
    // 提取会话令牌
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Authentication required'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const sessionToken = authHeader.substring(7);

    // 验证会话
    const sessionData = await env.SESSIONS_KV.get(`session:${sessionToken}`);

    if (!sessionData) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid or expired session'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const session = JSON.parse(sessionData);

    // 检查会话是否过期
    if (new Date(session.expiresAt) < new Date()) {
      await env.SESSIONS_KV.delete(`session:${sessionToken}`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Session expired'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 将用户信息附加到请求
    request.user = {
      id: session.userId,
      username: session.username,
      email: `${session.username}@example.com`,
      role: session.role,
      createdAt: session.createdAt,
      updatedAt: session.createdAt,
      isActive: true,
      passwordHash: ''
    };

    // 将会话信息附加到请求
    request.session = {
      sessionId: sessionToken,
      userId: session.userId,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt
    };

    return null; // 继续到下一个中间件/处理器

  } catch (error) {
    console.error('Auth middleware error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Authentication failed'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Admin role middleware
 */
export async function adminMiddleware(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response | null> {
  if (!request.user) {
    return createUnauthorizedResponse('Authentication required');
  }

  if (request.user.role !== 'admin') {
    return createForbiddenResponse('Admin access required');
  }

  return null; // Continue to next middleware/handler
}

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
export async function optionalAuthMiddleware(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response | null> {
  try {
    const sessionToken = extractSessionToken(request);

    if (!sessionToken) {
      return null; // No token, but that's okay
    }

    // Try to validate session and attach user if valid
    const authService = new AuthService(env);
    const user = await authService.validateSession(sessionToken);

    if (user) {
      const session = await authService.getSessionByToken(sessionToken);
      if (session && user.isActive) {
        request.user = user;
        request.session = session;
      }
    }

    return null; // Continue regardless of token validity
  } catch (error) {
    // Ignore errors in optional auth
    return null;
  }
}

/**
 * Rate limiting middleware
 */
export async function rateLimitMiddleware(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  limit: number,
  windowMs: number = 60000 // 1 minute default
): Promise<Response | null> {
  try {
    // Get client IP (use CF-Connecting-IP header if available)
    const clientIP = request.headers.get('CF-Connecting-IP') || 
                    request.headers.get('X-Forwarded-For') || 
                    'unknown';
    
    const key = `rate_limit:${clientIP}:${new URL(request.url).pathname}`;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Get current request count
    const currentData = await env.SESSIONS_KV.get(key);
    let requests: number[] = currentData ? JSON.parse(currentData) : [];
    
    // Filter out old requests outside the window
    requests = requests.filter(timestamp => timestamp > windowStart);
    
    // Check if limit exceeded
    if (requests.length >= limit) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((requests[0] + windowMs - now) / 1000),
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil((requests[0] + windowMs - now) / 1000).toString(),
        },
      });
    }
    
    // Add current request
    requests.push(now);
    
    // Store updated request count
    await env.SESSIONS_KV.put(key, JSON.stringify(requests), {
      expirationTtl: Math.ceil(windowMs / 1000),
    });
    
    return null; // Continue to next middleware/handler
  } catch (error) {
    console.error('Rate limit middleware error:', error);
    return null; // Continue on error
  }
}

/**
 * Create rate limit middleware for login endpoints
 */
export function createLoginRateLimitMiddleware(env: Env) {
  const limit = parseInt(env.RATE_LIMIT_LOGIN || '10', 10); // 硬编码默认值：10次/分钟
  return (request: Request, _env: Env, ctx: ExecutionContext) =>
    rateLimitMiddleware(request, env, ctx, limit, 60000); // 1 minute window
}

/**
 * Create rate limit middleware for API endpoints
 */
export function createApiRateLimitMiddleware(env: Env) {
  const limit = parseInt(env.RATE_LIMIT_API || '100', 10); // 硬编码默认值：100次/分钟
  return (request: Request, _env: Env, ctx: ExecutionContext) =>
    rateLimitMiddleware(request, env, ctx, limit, 60000); // 1 minute window
}

/**
 * Middleware to extract user info from context
 */
export function getCurrentUser(request: AuthenticatedRequest): User | null {
  return request.user || null;
}

/**
 * Middleware to extract session info from context
 */
export function getCurrentSession(request: AuthenticatedRequest): UserSession | null {
  return request.session || null;
}

/**
 * Check if current user is admin
 */
export function isCurrentUserAdmin(request: AuthenticatedRequest): boolean {
  return request.user?.role === 'admin' || false;
}

/**
 * Get user ID from authenticated request
 */
export function getCurrentUserId(request: AuthenticatedRequest): string | null {
  return request.user?.id || null;
}
