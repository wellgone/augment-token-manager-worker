// Environment bindings
export interface Env {
  // KV Namespaces
  USERS_KV: KVNamespace;
  TOKENS_KV: KVNamespace;
  SESSIONS_KV: KVNamespace;
  
  // D1 Database (optional)
  DB?: D1Database;
  
  // Secrets
  JWT_SECRET: string;
  ADMIN_PASSWORD: string;
  EMAIL_API_KEY?: string;
  
  // Environment variables
  ALLOWED_ORIGINS: string;
  JWT_EXPIRES_IN: string;
  REFRESH_TOKEN_EXPIRES_IN: string;
  RATE_LIMIT_LOGIN: string;
  RATE_LIMIT_API: string;
}

// User types
export interface User {
  id: string;
  username: string;
  email?: string;
  passwordHash: string;
  role: 'admin' | 'user';
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface UserSession {
  userId: string;
  sessionId: string;
  createdAt: string;
  expiresAt: string;
  ipAddress?: string;
  userAgent?: string;
}

// JWT types
export interface JWTPayload {
  sub: string; // user id
  username: string;
  role: 'admin' | 'user';
  iat: number;
  exp: number;
  sessionId: string;
}

export interface RefreshTokenPayload {
  sub: string;
  sessionId: string;
  iat: number;
  exp: number;
}

// Token management types (based on Go backend)
export interface TokenRecord {
  id: string;
  tenant_url?: string;
  access_token: string;
  portal_url?: string;
  email_note?: string;
  ban_status?: string;
  portal_info?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

// UUID management types
export interface UuidRecord {
  id: string;
  uuid: string;
  name: string;
  description?: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  isActive: boolean;
}

// Activation code types
export interface ActivationCode {
  id: string;
  code: string;
  name: string;
  description?: string;
  maxUses: number;
  currentUses: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  expiresAt?: string;
  isActive: boolean;
}

export interface ActivationCodeUsage {
  id: string;
  codeId: string;
  usedBy?: string;
  usedAt: string;
  ipAddress?: string;
  userAgent?: string;
}

// Email subscription types
export interface EmailSubscription {
  id: string;
  email: string;
  name?: string;
  categories: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  unsubscribedAt?: string;
}

// API Request/Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Request types (based on Go backend)
export interface LoginRequest {
  username: string;
  password: string;
}

export interface CreateTokenRequest {
  tenant_url?: string;
  access_token: string;
  portal_url?: string;
  email_note?: string;
}

export interface UpdateTokenRequest {
  tenant_url?: string;
  access_token?: string;
  portal_url?: string;
  email_note?: string;
}

export interface CreateUuidRequest {
  name: string;
  description?: string;
  category?: string;
}

export interface CreateActivationCodeRequest {
  name: string;
  description?: string;
  maxUses: number;
  expiresAt?: string;
}

export interface EmailSubscriptionRequest {
  email: string;
  name?: string;
  categories: string[];
}

// Middleware types
export interface AuthenticatedRequest extends Request {
  user?: User;
  session?: UserSession;
  validatedData?: any;
  params?: Record<string, string>;
  batchData?: any[];
}

// Route handler type
export type RouteHandler = (
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
) => Promise<Response>;

// Middleware type
export type Middleware = (
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
) => Promise<Response | null>;

// HTTP methods
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS';

// Route definition
export interface Route {
  method: HttpMethod;
  path: string;
  handler: RouteHandler;
  middlewares?: Middleware[];
  requiresAuth?: boolean;
  requiresAdmin?: boolean;
}

// Error types
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Validation types
export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'email' | 'uuid';
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}
