import { Env, AuthenticatedRequest, CreateTokenRequest, UpdateTokenRequest } from '../types/index.js';
import { TokenService } from '../services/tokenService.js';
import {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createPaginatedResponse,
  parseJsonBody,
  getPaginationParams,
  getQueryParams
} from '../utils/response.js';
import { validateData, ValidationRules } from '../utils/validation.js';
import { getCurrentUser } from '../middleware/auth.js';

/**
 * Get all tokens with pagination
 */
export async function getTokensHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return createErrorResponse('Authentication required', 401);
    }
    
    const url = new URL(request.url);
    const { page, limit } = getPaginationParams(url);
    const queryParams = getQueryParams(url);
    
    const tokenService = new TokenService(env);
    
    // If search parameters are provided, use search
    if (queryParams.search || queryParams.category) {
      const tokens = await tokenService.searchTokens({
        search: queryParams.search,
        category: queryParams.category,
        createdBy: user.role === 'admin' ? undefined : user.id,
      });
      
      // Manual pagination for search results
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedTokens = tokens.slice(startIndex, endIndex);
      
      return createPaginatedResponse(
        paginatedTokens,
        page,
        limit,
        tokens.length
        // 移除message，前端未使用
      );
    }
    
    // Regular listing with pagination
    const result = await tokenService.listTokens(page, limit);
    
    return createPaginatedResponse(
      result.tokens,
      result.page,
      result.limit,
      result.total
      // 移除message，前端未使用
    );
    
  } catch (error) {
    console.error('Get tokens error:', error);
    return createErrorResponse('Failed to retrieve tokens', 500);
  }
}

/**
 * Get token by ID
 */
export async function getTokenByIdHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return createErrorResponse('Authentication required', 401);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const tokenId = pathParts[pathParts.indexOf('tokens') + 1];

    if (!tokenId || tokenId === 'tokens') {
      return createErrorResponse('Token ID is required', 400);
    }
    
    const tokenService = new TokenService(env);
    const token = await tokenService.getTokenById(tokenId);
    
    if (!token) {
      return createNotFoundResponse('Token not found');
    }
    
    // Check if user can access this token
    if (user.role !== 'admin' && token.created_by !== user.id) {
      return createErrorResponse('Access denied', 403);
    }
    
    return createSuccessResponse(token); // 移除message，前端未使用
    
  } catch (error) {
    console.error('Get token by ID error:', error);
    return createErrorResponse('Failed to retrieve token', 500);
  }
}

/**
 * Create new token
 */
export async function createTokenHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return createErrorResponse('Authentication required', 401);
    }
    
    const body = await parseJsonBody<CreateTokenRequest>(request);
    
    // Validate input
    const validation = validateData(body, [
      { field: 'access_token', required: true, type: 'string', minLength: 1 },
      { field: 'tenant_url', required: false, type: 'string' },
      { field: 'portal_url', required: false, type: 'string' },
      { field: 'email_note', required: false, type: 'string' },
    ]);
    
    if (!validation.isValid) {
      return createErrorResponse(
        `Validation failed: ${validation.errors.join(', ')}`,
        400
      );
    }
    
    const tokenService = new TokenService(env);
    const token = await tokenService.createToken(body, user.id);
    
    return createSuccessResponse(token, 'Token保存成功', 201); // 保留message，前端使用
    
  } catch (error) {
    console.error('Create token error:', error);
    return createErrorResponse('Failed to create token', 500);
  }
}

/**
 * Update token
 */
export async function updateTokenHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return createErrorResponse('Authentication required', 401);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const tokenId = pathParts[pathParts.indexOf('tokens') + 1];

    console.log('Update token request:', {
      url: url.pathname,
      pathParts,
      tokenId,
      isReactivate: true
    });

    if (!tokenId || tokenId === 'tokens') {
      return createErrorResponse('Token ID is required', 400);
    }
    
    const body = await parseJsonBody<UpdateTokenRequest>(request);
    
    const tokenService = new TokenService(env);
    
    // Check if token exists and user has access
    const existingToken = await tokenService.getTokenById(tokenId);
    if (!existingToken) {
      return createNotFoundResponse('Token not found');
    }
    
    if (user.role !== 'admin' && existingToken.created_by !== user.id) {
      return createErrorResponse('Access denied', 403);
    }
    
    const updatedToken = await tokenService.updateToken(tokenId, body);
    
    if (!updatedToken) {
      return createNotFoundResponse('Token not found');
    }
    
    return createSuccessResponse(updatedToken, 'Token更新成功'); // 保留message，前端使用
    
  } catch (error) {
    console.error('Update token error:', error);
    return createErrorResponse('Failed to update token', 500);
  }
}

/**
 * Delete token
 */
export async function deleteTokenHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return createErrorResponse('Authentication required', 401);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const tokenId = pathParts[pathParts.indexOf('tokens') + 1];

    if (!tokenId || tokenId === 'tokens') {
      return createErrorResponse('Token ID is required', 400);
    }
    
    const tokenService = new TokenService(env);
    
    // Check if token exists and user has access
    const existingToken = await tokenService.getTokenById(tokenId);
    if (!existingToken) {
      return createNotFoundResponse('Token not found');
    }
    
    if (user.role !== 'admin' && existingToken.created_by !== user.id) {
      return createErrorResponse('Access denied', 403);
    }
    
    const deleted = await tokenService.deleteToken(tokenId);
    
    if (!deleted) {
      return createNotFoundResponse('Token not found');
    }
    
    return createSuccessResponse(null, 'Token删除成功'); // 保留message，前端使用
    
  } catch (error) {
    console.error('Delete token error:', error);
    return createErrorResponse('Failed to delete token', 500);
  }
}

/**
 * Batch import tokens
 */
export async function batchImportTokensHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return createErrorResponse('Authentication required', 401);
    }
    
    const body = await parseJsonBody<{ tokens: CreateTokenRequest[] }>(request);
    
    if (!body.tokens || !Array.isArray(body.tokens)) {
      return createErrorResponse('Tokens array is required', 400);
    }
    
    if (body.tokens.length === 0) {
      return createErrorResponse('At least one token is required', 400);
    }
    
    if (body.tokens.length > 100) {
      return createErrorResponse('Maximum 100 tokens allowed per batch', 400);
    }
    
    const tokenService = new TokenService(env);
    const result = await tokenService.batchImportTokens(body.tokens, user.id);
    
    return createSuccessResponse({
      imported: result.success.length,
      failed: result.failed.length,
      success: result.success,
      errors: result.failed,
    }, `批量导入完成。导入 ${result.success.length} 条，失败 ${result.failed.length} 条。`);
    
  } catch (error) {
    console.error('Batch import error:', error);
    return createErrorResponse('Failed to import tokens', 500);
  }
}

/**
 * Validate token status
 */
export async function validateTokenStatusHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return createErrorResponse('Authentication required', 401);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const tokenId = pathParts[pathParts.indexOf('tokens') + 1];
    
    if (!tokenId) {
      return createErrorResponse('Token ID is required', 400);
    }
    
    const tokenService = new TokenService(env);
    
    // Check if token exists and user has access
    const existingToken = await tokenService.getTokenById(tokenId);
    if (!existingToken) {
      return createNotFoundResponse('Token not found');
    }
    
    if (user.role !== 'admin' && existingToken.created_by !== user.id) {
      return createErrorResponse('Access denied', 403);
    }
    
    const result = await tokenService.validateTokenStatus(tokenId);

    const message = result.isValid ? 'Token状态正常' : 'Token已失效，状态已更新';

    return new Response(JSON.stringify({
      success: true,
      data: result.token,
      valid: result.isValid,
      message: message
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Validate token status error:', error);
    return createErrorResponse('Failed to validate token status', 500);
  }
}

/**
 * Batch validate tokens
 */
export async function batchValidateTokensHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return createErrorResponse('Authentication required', 401);
    }

    const body = await parseJsonBody<{ tokenIds: string[] }>(request);

    if (!body.tokenIds || !Array.isArray(body.tokenIds)) {
      return createErrorResponse('tokenIds array is required', 400);
    }

    if (body.tokenIds.length === 0) {
      return createErrorResponse('At least one token ID is required', 400);
    }

    if (body.tokenIds.length > 50) {
      return createErrorResponse('Maximum 50 tokens can be validated at once', 400);
    }

    const tokenService = new TokenService(env);

    // 验证用户权限 - 只能验证自己的token（除非是admin）
    if (user.role !== 'admin') {
      const tokenChecks = await Promise.all(
        body.tokenIds.map(id => tokenService.getTokenById(id))
      );

      const unauthorizedTokens = tokenChecks.filter(
        token => token && token.created_by !== user.id
      );

      if (unauthorizedTokens.length > 0) {
        return createErrorResponse('Access denied to some tokens', 403);
      }
    }

    const results = await tokenService.validateTokensBatch(body.tokenIds);

    return createSuccessResponse({
      results,
      summary: {
        total: results.length,
        valid: results.filter(r => r.isValid).length,
        invalid: results.filter(r => !r.isValid).length,
        errors: results.filter(r => r.error).length
      }
    }, 'Batch validation completed');

  } catch (error) {
    console.error('Batch validate tokens error:', error);
    return createErrorResponse('Failed to validate tokens', 500);
  }
}

/**
 * Refresh token information
 */
export async function refreshTokenHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return createErrorResponse('Authentication required', 401);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const tokenId = pathParts[pathParts.indexOf('tokens') + 1];
    
    if (!tokenId) {
      return createErrorResponse('Token ID is required', 400);
    }
    
    const tokenService = new TokenService(env);
    
    // Check if token exists and user has access
    const existingToken = await tokenService.getTokenById(tokenId);
    if (!existingToken) {
      return createNotFoundResponse('Token not found');
    }
    
    if (user.role !== 'admin' && existingToken.created_by !== user.id) {
      return createErrorResponse('Access denied', 403);
    }
    
    const refreshedToken = await tokenService.refreshTokenInfo(tokenId);
    
    if (!refreshedToken) {
      return createNotFoundResponse('Token not found');
    }
    
    return createSuccessResponse(refreshedToken, 'Token信息已刷新'); // 保留message，前端使用
    
  } catch (error) {
    console.error('Refresh token error:', error);
    return createErrorResponse('Failed to refresh token', 500);
  }
}

/**
 * Get token statistics
 */
export async function getTokenStatsHandler(
  request: AuthenticatedRequest,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const user = getCurrentUser(request);
    if (!user) {
      return createErrorResponse('Authentication required', 401);
    }
    
    const tokenService = new TokenService(env);
    const stats = await tokenService.getTokenStats();
    
    return createSuccessResponse(stats); // 移除message，前端未使用
    
  } catch (error) {
    console.error('Get token stats error:', error);
    return createErrorResponse('Failed to get token statistics', 500);
  }
}
