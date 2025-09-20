import { Env, AuthenticatedRequest, User, UserSession } from '../types/index.js';
import { verifyAccessToken, extractBearerToken } from '../utils/jwt.js';
import { createUnauthorizedResponse, createForbiddenResponse } from '../utils/response.js';

/**
 * JWT Authentication middleware
 */
export async function authMiddleware(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response | null> {
  try {
    // Extract token from Authorization header
    const token = extractBearerToken(request);
    
    if (!token) {
      return createUnauthorizedResponse('Authorization token required');
    }

    // Verify JWT token
    const payload = await verifyAccessToken(token, env.JWT_SECRET);
    
    // Check if session exists and is valid
    const sessionKey = `session:${payload.sessionId}`;
    const sessionData = await env.SESSIONS_KV.get(sessionKey);
    
    if (!sessionData) {
      return createUnauthorizedResponse('Session expired or invalid');
    }

    const session: UserSession = JSON.parse(sessionData);
    
    // Check if session is expired
    if (new Date(session.expiresAt) < new Date()) {
      // Clean up expired session
      await env.SESSIONS_KV.delete(sessionKey);
      return createUnauthorizedResponse('Session expired');
    }

    // Get user data
    const userKey = `user:${payload.sub}`;
    const userData = await env.USERS_KV.get(userKey);
    
    if (!userData) {
      return createUnauthorizedResponse('User not found');
    }

    const user: User = JSON.parse(userData);
    
    // Check if user is active
    if (!user.isActive) {
      return createForbiddenResponse('User account is disabled');
    }

    // Attach user and session to request
    request.user = user;
    request.session = session;

    // Update session activity (extend expiration)
    const updatedSession: UserSession = {
      ...session,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Extend by 24 hours
    };
    
    await env.SESSIONS_KV.put(sessionKey, JSON.stringify(updatedSession), {
      expirationTtl: 24 * 60 * 60, // 24 hours
    });

    return null; // Continue to next middleware/handler
  } catch (error) {
    console.error('Auth middleware error:', error);
    return createUnauthorizedResponse('Invalid token');
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
    const token = extractBearerToken(request);
    
    if (!token) {
      return null; // No token, but that's okay
    }

    // Try to verify token and attach user if valid
    const payload = await verifyAccessToken(token, env.JWT_SECRET);
    const sessionKey = `session:${payload.sessionId}`;
    const sessionData = await env.SESSIONS_KV.get(sessionKey);
    
    if (sessionData) {
      const session: UserSession = JSON.parse(sessionData);
      
      if (new Date(session.expiresAt) >= new Date()) {
        const userKey = `user:${payload.sub}`;
        const userData = await env.USERS_KV.get(userKey);
        
        if (userData) {
          const user: User = JSON.parse(userData);
          if (user.isActive) {
            request.user = user;
            request.session = session;
          }
        }
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
  const limit = parseInt(env.RATE_LIMIT_LOGIN, 10) || 10;
  return (request: Request, _env: Env, ctx: ExecutionContext) => 
    rateLimitMiddleware(request, env, ctx, limit, 60000); // 1 minute window
}

/**
 * Create rate limit middleware for API endpoints
 */
export function createApiRateLimitMiddleware(env: Env) {
  const limit = parseInt(env.RATE_LIMIT_API, 10) || 100;
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
