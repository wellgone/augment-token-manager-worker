import { Env } from '../types/index.js';
import { createCorsResponse } from '../utils/response.js';

/**
 * CORS middleware for handling cross-origin requests
 */
export async function corsMiddleware(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response | null> {
  const origin = request.headers.get('Origin');
  const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  
  // Handle preflight OPTIONS requests
  if (request.method === 'OPTIONS') {
    return createCorsResponse(allowedOrigins);
  }
  
  // For non-preflight requests, we'll add CORS headers in the response
  // This is handled in the addCorsHeaders utility function
  return null;
}

/**
 * Check if origin is allowed
 */
export function isOriginAllowed(origin: string | null, allowedOrigins: string[]): boolean {
  if (!origin) return true; // Allow requests without origin (e.g., same-origin)
  
  return allowedOrigins.some(allowed => {
    if (allowed === '*') return true;
    if (allowed === origin) return true;
    
    // Support wildcard subdomains (e.g., *.example.com)
    if (allowed.startsWith('*.')) {
      const domain = allowed.substring(2);
      return origin.endsWith('.' + domain) || origin === domain;
    }
    
    return false;
  });
}

/**
 * Add CORS headers to response
 */
export function addCorsHeaders(response: Response, env: Env, origin?: string | null): Response {
  const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  
  // Clone the response to modify headers
  const newResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
  });
  
  // Determine which origin to allow
  let allowOrigin = '*';
  if (origin && isOriginAllowed(origin, allowedOrigins)) {
    allowOrigin = origin;
  } else if (allowedOrigins.length === 1 && allowedOrigins[0] !== '*') {
    allowOrigin = allowedOrigins[0];
  }
  
  // Add CORS headers
  newResponse.headers.set('Access-Control-Allow-Origin', allowOrigin);
  newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  newResponse.headers.set('Access-Control-Allow-Credentials', 'true');
  newResponse.headers.set('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Add security headers
  newResponse.headers.set('X-Content-Type-Options', 'nosniff');
  newResponse.headers.set('X-Frame-Options', 'DENY');
  newResponse.headers.set('X-XSS-Protection', '1; mode=block');
  newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  return newResponse;
}

/**
 * Security headers middleware
 */
export async function securityHeadersMiddleware(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response | null> {
  // This middleware doesn't block requests, it just ensures security headers are added
  // The actual headers are added in the addCorsHeaders function
  return null;
}

/**
 * Content-Type validation middleware
 */
export async function contentTypeMiddleware(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response | null> {
  // Only validate content-type for requests with body
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    const contentType = request.headers.get('Content-Type');
    
    if (!contentType) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Content-Type header is required',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Allow application/json and multipart/form-data
    if (!contentType.includes('application/json') && 
        !contentType.includes('multipart/form-data') &&
        !contentType.includes('application/x-www-form-urlencoded')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unsupported Content-Type. Use application/json',
      }), {
        status: 415,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  return null;
}

/**
 * Request size limit middleware
 */
export async function requestSizeLimitMiddleware(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  maxSizeBytes: number = 1024 * 1024 // 1MB default
): Promise<Response | null> {
  const contentLength = request.headers.get('Content-Length');
  
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (size > maxSizeBytes) {
      return new Response(JSON.stringify({
        success: false,
        error: `Request too large. Maximum size is ${maxSizeBytes} bytes`,
      }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  return null;
}

/**
 * Request method validation middleware
 */
export async function methodValidationMiddleware(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  allowedMethods: string[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
): Promise<Response | null> {
  if (!allowedMethods.includes(request.method)) {
    return new Response(JSON.stringify({
      success: false,
      error: `Method ${request.method} not allowed`,
    }), {
      status: 405,
      headers: { 
        'Content-Type': 'application/json',
        'Allow': allowedMethods.join(', '),
      },
    });
  }
  
  return null;
}

/**
 * User-Agent validation middleware (optional)
 */
export async function userAgentValidationMiddleware(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response | null> {
  const userAgent = request.headers.get('User-Agent');
  
  // Block requests without User-Agent (potential bots)
  if (!userAgent || userAgent.trim().length === 0) {
    return new Response(JSON.stringify({
      success: false,
      error: 'User-Agent header is required',
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  // Block known bad user agents (customize as needed)
  const blockedUserAgents = [
    'curl',
    'wget',
    'python-requests',
    'bot',
    'crawler',
    'spider',
  ];
  
  const userAgentLower = userAgent.toLowerCase();
  for (const blocked of blockedUserAgents) {
    if (userAgentLower.includes(blocked)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Access denied',
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  return null;
}

/**
 * IP whitelist middleware (optional)
 */
export async function ipWhitelistMiddleware(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  allowedIPs: string[] = []
): Promise<Response | null> {
  if (allowedIPs.length === 0) {
    return null; // No IP restrictions
  }
  
  const clientIP = request.headers.get('CF-Connecting-IP') || 
                  request.headers.get('X-Forwarded-For') || 
                  'unknown';
  
  if (!allowedIPs.includes(clientIP)) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Access denied from this IP address',
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  return null;
}
