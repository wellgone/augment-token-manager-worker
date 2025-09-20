import { Env, TokenRecord, CreateTokenRequest, UpdateTokenRequest } from '../types/index.js';

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

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
      ban_status: JSON.stringify({ status: 'NORMAL', reason: 'Initial state', updated_at: now }), // New status format
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
    token?: TokenRecord;
  }> {
    const token = await this.getTokenById(tokenId);
    if (!token) {
      return { isValid: false, status: 'Token not found' };
    }

    try {
      // 检查必要字段
      if (!token.tenant_url || !token.access_token) {
        return { isValid: false, status: 'Token缺少必要的字段', token };
      }

      // 构建请求URL
      const baseURL = token.tenant_url.replace(/\/$/, '');
      const apiUrl = `${baseURL}/get-models`;

      // 构建请求头
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.access_token}`
      };
      // 发送验证请求
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: headers
      });

      let isValid = false;
      let status = '';

      if (response.ok) {
        // 验证成功 - response.ok为true表示token有效
        isValid = true;
        status = 'Token状态正常';
      } else {
        // 验证失败 - response.ok为false表示token失效或其他错误
        if (response.status === 401 || response.status === 403) {
          isValid = false;
          status = 'Token已失效';
        } else {
          isValid = false;
          status = `验证失败，状态码: ${response.status}`;
        }
      }

      // 更新ban_status，使用新的状态枚举
      const banStatus = isValid
        ? JSON.stringify({ status: 'NORMAL', reason: 'Token validation successful', updated_at: new Date().toISOString() })
        : JSON.stringify({ status: 'INVALID', reason: 'Token validation failed', updated_at: new Date().toISOString() });

      const updatedToken: TokenRecord = {
        ...token,
        ban_status: banStatus,
        updated_at: new Date().toISOString(),
        // 保留原有的portal_info，不要覆盖
      };

      await this.env.TOKENS_KV.put(`token:${tokenId}`, JSON.stringify(updatedToken));

      return {
        isValid,
        status,
        token: updatedToken,
      };

    } catch (error) {
      console.error('Token validation error:', error);
      return {
        isValid: false,
        status: `验证过程中发生错误: ${error instanceof Error ? error.message : 'Unknown error'}`,
        token,
      };
    }
  }

  /**
   * Refresh token information (fetch latest data from API)
   */
  async refreshTokenInfo(tokenId: string): Promise<TokenRecord | null> {
    const token = await this.getTokenById(tokenId);
    if (!token) {
      return null;
    }

    try {
      // 从 portal_url 中提取 token 参数
      const portalUrl = token.portal_url;
      if (!portalUrl) {
        throw new Error('Token 没有 portal_url 信息');
      }

      const tokenParam = this.extractTokenFromURL(portalUrl);
      if (!tokenParam) {
        throw new Error('从 portal_url 解析 token 参数失败');
      }

      // 第一步：获取客户信息
      const customerInfo = await this.getCustomerFromLink(tokenParam);

      // 第二步：获取账户余额信息
      const ledgerInfo = await this.getLedgerSummary(customerInfo, tokenParam);

      // 第三步：更新 portal_info 和状态
      const portalInfo = {
        credits_balance: this.parseCreditsBalance(ledgerInfo.credits_balance),
        is_active: ledgerInfo.credit_blocks.length > 0 ? ledgerInfo.credit_blocks[0].is_active : false,
        expiry_date: ledgerInfo.credit_blocks.length > 0 ? ledgerInfo.credit_blocks[0].expiry_date : '',
      };

      // 刷新操作只更新portal_info，不修改ban_status
      const updatedToken: TokenRecord = {
        ...token,
        portal_info: JSON.stringify(portalInfo),
        updated_at: new Date().toISOString(),
      };

      await this.env.TOKENS_KV.put(`token:${tokenId}`, JSON.stringify(updatedToken));

      return updatedToken;

    } catch (error) {
      console.error('Token refresh error:', error);
      // 如果刷新失败，至少更新时间戳
      const updatedToken: TokenRecord = {
        ...token,
        updated_at: new Date().toISOString(),
      };

      await this.env.TOKENS_KV.put(`token:${tokenId}`, JSON.stringify(updatedToken));

      return updatedToken;
    }
  }

  /**
   * 从 portal_url 中提取 token 参数
   */
  private extractTokenFromURL(portalUrl: string): string | null {
    try {
      const url = new URL(portalUrl);
      return url.searchParams.get('token');
    } catch {
      return null;
    }
  }

  /**
   * 第一步：获取客户信息
   */
  private async getCustomerFromLink(tokenParam: string): Promise<any> {
    const apiUrl = `https://portal.withorb.com/api/v1/customer_from_link?token=${tokenParam}`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
        'Connection': 'keep-alive',
        'Referer': `https://portal.withorb.com/view?token=${tokenParam}`,
        'Origin': 'https://portal.withorb.com',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(`客户信息 API 返回错误状态码: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * 第二步：获取账户余额信息
   */
  private async getLedgerSummary(customerInfo: any, tokenParam: string): Promise<any> {
    if (!customerInfo.customer?.ledger_pricing_units?.length) {
      throw new Error('客户信息中没有 pricing unit');
    }

    const customerId = customerInfo.customer.id;
    const pricingUnitId = customerInfo.customer.ledger_pricing_units[0].id;

    const apiUrl = `https://portal.withorb.com/api/v1/customers/${customerId}/ledger_summary?pricing_unit_id=${pricingUnitId}&token=${tokenParam}`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
        'Connection': 'keep-alive',
        'Referer': `https://portal.withorb.com/view?token=${tokenParam}`,
        'Origin': 'https://portal.withorb.com',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
      },
    });

    if (!response.ok) {
      throw new Error(`账户余额 API 返回错误状态码: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * 解析 credits_balance 字符串为数字
   */
  private parseCreditsBalance(creditsStr: string): number {
    // 移除小数点，将 "16.00" 转换为 16
    const dotIndex = creditsStr.indexOf('.');
    if (dotIndex !== -1) {
      creditsStr = creditsStr.substring(0, dotIndex);
    }

    return parseInt(creditsStr, 10) || 0;
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
