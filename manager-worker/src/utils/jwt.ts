import { SignJWT, jwtVerify, JWTPayload as JoseJWTPayload } from 'jose';
import { JWTPayload, RefreshTokenPayload } from '../types/index.js';

/**
 * Generate a JWT access token
 */
export async function generateAccessToken(
  payload: Omit<JWTPayload, 'iat' | 'exp'>,
  secret: string,
  expiresIn: string = '24h'
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);
  
  const expirationTime = parseExpirationTime(expiresIn);
  const now = Math.floor(Date.now() / 1000);
  
  const jwt = await new SignJWT({
    sub: payload.sub,
    username: payload.username,
    role: payload.role,
    sessionId: payload.sessionId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + expirationTime)
    .setIssuer('augment-token-manager')
    .setAudience('augment-token-manager-api')
    .sign(secretKey);

  return jwt;
}

/**
 * Generate a JWT refresh token
 */
export async function generateRefreshToken(
  payload: Omit<RefreshTokenPayload, 'iat' | 'exp'>,
  secret: string,
  expiresIn: string = '7d'
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);
  
  const expirationTime = parseExpirationTime(expiresIn);
  const now = Math.floor(Date.now() / 1000);
  
  const jwt = await new SignJWT({
    sub: payload.sub,
    sessionId: payload.sessionId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + expirationTime)
    .setIssuer('augment-token-manager')
    .setAudience('augment-token-manager-refresh')
    .sign(secretKey);

  return jwt;
}

/**
 * Verify and decode a JWT token
 */
export async function verifyAccessToken(
  token: string,
  secret: string
): Promise<JWTPayload> {
  try {
    const secretKey = new TextEncoder().encode(secret);
    
    const { payload } = await jwtVerify(token, secretKey, {
      issuer: 'augment-token-manager',
      audience: 'augment-token-manager-api',
    });

    return {
      sub: payload.sub as string,
      username: payload.username as string,
      role: payload.role as 'admin' | 'user',
      sessionId: payload.sessionId as string,
      iat: payload.iat as number,
      exp: payload.exp as number,
    };
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Verify and decode a refresh token
 */
export async function verifyRefreshToken(
  token: string,
  secret: string
): Promise<RefreshTokenPayload> {
  try {
    const secretKey = new TextEncoder().encode(secret);
    
    const { payload } = await jwtVerify(token, secretKey, {
      issuer: 'augment-token-manager',
      audience: 'augment-token-manager-refresh',
    });

    return {
      sub: payload.sub as string,
      sessionId: payload.sessionId as string,
      iat: payload.iat as number,
      exp: payload.exp as number,
    };
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
}

/**
 * Extract token from Authorization header
 */
export function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  return authHeader.substring(7); // Remove 'Bearer ' prefix
}

/**
 * Check if token is expired
 */
export function isTokenExpired(payload: JWTPayload | RefreshTokenPayload): boolean {
  const now = Math.floor(Date.now() / 1000);
  return payload.exp <= now;
}

/**
 * Get token expiration time in seconds
 */
export function getTokenExpirationTime(payload: JWTPayload | RefreshTokenPayload): Date {
  return new Date(payload.exp * 1000);
}

/**
 * Parse expiration time string to seconds
 */
function parseExpirationTime(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  
  if (!match) {
    throw new Error('Invalid expiration time format. Use format like "1h", "30m", "7d"');
  }
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 24 * 60 * 60;
    default:
      throw new Error('Invalid time unit. Use s, m, h, or d');
  }
}

/**
 * Generate a secure session ID
 */
export function generateSessionId(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash password using Web Crypto API
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

/**
 * Generate a random token/code
 */
export function generateRandomToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  
  return Array.from(array, byte => chars[byte % chars.length]).join('');
}

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  
  // Set version (4) and variant bits
  array[6] = (array[6] & 0x0f) | 0x40;
  array[8] = (array[8] & 0x3f) | 0x80;
  
  const hex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  
  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20, 32)
  ].join('-');
}
