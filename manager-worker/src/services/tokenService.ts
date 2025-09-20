import { Env, TokenRecord, CreateTokenRequest, UpdateTokenRequest } from '../types/index.js';
import { generateUUID } from '../utils/jwt.js';

/**
 * Token management service
 */
export class TokenService {
  constructor(private env: Env) {}

  /**
   * Create a new token
   */
  async createToken(tokenData: CreateTokenRequest, createdBy: string): Promise<TokenRecord> {
    const tokenId = generateUUID();
    const now = new Date().toISOString();
    
    const token: TokenRecord = {
      id: tokenId,
      tenant_url: tokenData.tenant_url,
      access_token: tokenData.access_token,
      portal_url: tokenData.portal_url,
      email_note: tokenData.email_note,
      ban_status: '{}', // Default empty JSON
      portal_info: '{}', // Default empty JSON
      created_at: now,
      updated_at: now,
      created_by: createdBy,
    };
    
    // Store token in KV
    await this.env.TOKENS_KV.put(`token:${tokenId}`, JSON.stringify(token));
    
    // Update token index for listing (simple approach)
    await this.addToTokenIndex(tokenId);
    
    return token;
  }

  /**
   * Get token by ID
   */
  async getTokenById(tokenId: string): Promise<TokenRecord | null> {
    const tokenData = await this.env.TOKENS_KV.get(`token:${tokenId}`);
    return tokenData ? JSON.parse(tokenData) : null;
  }

  /**
   * Update token
   */
  async updateToken(tokenId: string, updates: UpdateTokenRequest): Promise<TokenRecord | null> {
    const existingToken = await this.getTokenById(tokenId);
    if (!existingToken) {
      return null;
    }
    
    const updatedToken: TokenRecord = {
      ...existingToken,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    
    await this.env.TOKENS_KV.put(`token:${tokenId}`, JSON.stringify(updatedToken));
    
    return updatedToken;
  }

  /**
   * Delete token
   */
  async deleteToken(tokenId: string): Promise<boolean> {
    const token = await this.getTokenById(tokenId);
    if (!token) {
      return false;
    }
    
    await this.env.TOKENS_KV.delete(`token:${tokenId}`);
    await this.removeFromTokenIndex(tokenId);
    
    return true;
  }

  /**
   * List tokens with pagination
   */
  async listTokens(page: number = 1, limit: number = 10): Promise<{
    tokens: TokenRecord[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    // Get token index
    const indexData = await this.env.TOKENS_KV.get('token_index');
    const tokenIds: string[] = indexData ? JSON.parse(indexData) : [];
    
    const total = tokenIds.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    const paginatedIds = tokenIds.slice(startIndex, endIndex);
    
    // Fetch tokens
    const tokens: TokenRecord[] = [];
    for (const tokenId of paginatedIds) {
      const token = await this.getTokenById(tokenId);
      if (token) {
        tokens.push(token);
      }
    }
    
    return {
      tokens,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Search tokens by criteria
   */
  async searchTokens(criteria: {
    search?: string;
    category?: string;
    createdBy?: string;
  }): Promise<TokenRecord[]> {
    // Get all tokens (in a real implementation, you'd use a proper search index)
    const { tokens } = await this.listTokens(1, 1000); // Get up to 1000 tokens
    
    let filteredTokens = tokens;
    
    // Apply search filter
    if (criteria.search) {
      const searchTerm = criteria.search.toLowerCase();
      filteredTokens = filteredTokens.filter(token => 
        token.access_token.toLowerCase().includes(searchTerm) ||
        token.tenant_url?.toLowerCase().includes(searchTerm) ||
        token.email_note?.toLowerCase().includes(searchTerm)
      );
    }
    
    // Apply created by filter
    if (criteria.createdBy) {
      filteredTokens = filteredTokens.filter(token => 
        token.created_by === criteria.createdBy
      );
    }
    
    return filteredTokens;
  }

  /**
   * Batch import tokens
   */
  async batchImportTokens(tokens: CreateTokenRequest[], createdBy: string): Promise<{
    success: TokenRecord[];
    failed: { token: CreateTokenRequest; error: string }[];
  }> {
    const success: TokenRecord[] = [];
    const failed: { token: CreateTokenRequest; error: string }[] = [];
    
    for (const tokenData of tokens) {
      try {
        const token = await this.createToken(tokenData, createdBy);
        success.push(token);
      } catch (error) {
        failed.push({
          token: tokenData,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    
    return { success, failed };
  }

  /**
   * Validate token status (check if token is still valid)
   */
  async validateTokenStatus(tokenId: string): Promise<{
    isValid: boolean;
    status: string;
    portalInfo?: any;
  }> {
    const token = await this.getTokenById(tokenId);
    if (!token) {
      return { isValid: false, status: 'Token not found' };
    }
    
    // Parse portal info to check status
    let portalInfo: any = {};
    try {
      portalInfo = JSON.parse(token.portal_info || '{}');
    } catch {
      // Invalid JSON, treat as empty
    }
    
    // Check ban status
    let banStatus: any = {};
    try {
      banStatus = JSON.parse(token.ban_status || '{}');
    } catch {
      // Invalid JSON, treat as empty
    }
    
    // Simple validation logic (customize based on your needs)
    const isBanned = banStatus.banned === true;
    const hasExpired = portalInfo.expires_at && new Date(portalInfo.expires_at) < new Date();
    
    return {
      isValid: !isBanned && !hasExpired,
      status: isBanned ? 'banned' : hasExpired ? 'expired' : 'active',
      portalInfo,
    };
  }

  /**
   * Refresh token information (fetch latest data from API)
   */
  async refreshTokenInfo(tokenId: string): Promise<TokenRecord | null> {
    const token = await this.getTokenById(tokenId);
    if (!token) {
      return null;
    }
    
    // In a real implementation, you would make API calls to refresh the token data
    // For now, just update the updated_at timestamp
    const updatedToken: TokenRecord = {
      ...token,
      updated_at: new Date().toISOString(),
    };
    
    await this.env.TOKENS_KV.put(`token:${tokenId}`, JSON.stringify(updatedToken));
    
    return updatedToken;
  }

  /**
   * Get token statistics
   */
  async getTokenStats(): Promise<{
    total: number;
    active: number;
    banned: number;
    expired: number;
  }> {
    const { tokens } = await this.listTokens(1, 1000); // Get up to 1000 tokens
    
    let active = 0;
    let banned = 0;
    let expired = 0;
    
    for (const token of tokens) {
      const status = await this.validateTokenStatus(token.id);
      if (status.status === 'active') active++;
      else if (status.status === 'banned') banned++;
      else if (status.status === 'expired') expired++;
    }
    
    return {
      total: tokens.length,
      active,
      banned,
      expired,
    };
  }

  /**
   * Add token ID to index for listing
   */
  private async addToTokenIndex(tokenId: string): Promise<void> {
    const indexData = await this.env.TOKENS_KV.get('token_index');
    const tokenIds: string[] = indexData ? JSON.parse(indexData) : [];
    
    if (!tokenIds.includes(tokenId)) {
      tokenIds.unshift(tokenId); // Add to beginning for newest first
      await this.env.TOKENS_KV.put('token_index', JSON.stringify(tokenIds));
    }
  }

  /**
   * Remove token ID from index
   */
  private async removeFromTokenIndex(tokenId: string): Promise<void> {
    const indexData = await this.env.TOKENS_KV.get('token_index');
    const tokenIds: string[] = indexData ? JSON.parse(indexData) : [];
    
    const filteredIds = tokenIds.filter(id => id !== tokenId);
    await this.env.TOKENS_KV.put('token_index', JSON.stringify(filteredIds));
  }
}
