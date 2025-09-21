/**
 * OAuth Storage Module - KV Storage Management
 * 
 * This module provides OAuth state management using Cloudflare KV storage,
 * replacing Rust's in-memory state management.
 */

import { OAuthState } from './core';

/**
 * OAuth Storage Class - Manages OAuth state in KV storage
 * Replaces Rust's in-memory state management
 * Now uses SESSIONS_KV instead of dedicated OAUTH_KV
 */
export class OAuthStorage {
  private kv: KVNamespace;

  constructor(kvNamespace: KVNamespace) {
    this.kv = kvNamespace;
  }

  /**
   * Store OAuth state in KV storage
   * 
   * @param stateKey - Unique key for the OAuth state
   * @param oauthState - OAuth state object to store
   * @param ttlSeconds - Time to live in seconds (default: 600 = 10 minutes)
   */
  async storeOAuthState(
    stateKey: string, 
    oauthState: OAuthState, 
    ttlSeconds: number = 600
  ): Promise<void> {
    const key = `oauth_state_${stateKey}`;
    const value = JSON.stringify(oauthState);
    
    await this.kv.put(key, value, {
      expirationTtl: ttlSeconds
    });

    console.log('OAuth state stored:', {
      key,
      state: stateKey,
      ttl: ttlSeconds,
      creationTime: oauthState.creationTime
    });
  }

  /**
   * Retrieve OAuth state from KV storage
   * 
   * @param stateKey - Unique key for the OAuth state
   * @returns OAuth state object or null if not found/expired
   */
  async getOAuthState(stateKey: string): Promise<OAuthState | null> {
    const key = `oauth_state_${stateKey}`;
    const data = await this.kv.get(key);
    
    if (!data) {
      console.log('OAuth state not found:', { key, state: stateKey });
      return null;
    }

    try {
      const oauthState = JSON.parse(data) as OAuthState;
      
      // Additional validation - check if state is too old (safety check)
      const now = Date.now();
      const maxAge = 30 * 60 * 1000; // 30 minutes max
      
      if (now - oauthState.creationTime > maxAge) {
        console.log('OAuth state expired (age check):', {
          key,
          state: stateKey,
          age: now - oauthState.creationTime,
          maxAge
        });
        await this.deleteOAuthState(stateKey);
        return null;
      }

      console.log('OAuth state retrieved:', {
        key,
        state: stateKey,
        age: now - oauthState.creationTime
      });

      return oauthState;
    } catch (error) {
      console.error('Failed to parse OAuth state:', { key, error });
      await this.deleteOAuthState(stateKey);
      return null;
    }
  }

  /**
   * Delete OAuth state from KV storage
   * 
   * @param stateKey - Unique key for the OAuth state
   */
  async deleteOAuthState(stateKey: string): Promise<void> {
    const key = `oauth_state_${stateKey}`;
    await this.kv.delete(key);
    
    console.log('OAuth state deleted:', { key, state: stateKey });
  }

  /**
   * Clean up expired OAuth states
   * Note: KV storage automatically handles TTL expiration,
   * but this method can be used for manual cleanup if needed
   * 
   * @param maxAge - Maximum age in milliseconds (default: 30 minutes)
   */
  async cleanupExpiredStates(maxAge: number = 30 * 60 * 1000): Promise<number> {
    // KV doesn't support listing keys with prefix efficiently,
    // so we rely on TTL for automatic cleanup.
    // This method is here for compatibility but doesn't do much in KV context.
    console.log('OAuth state cleanup requested - relying on KV TTL');
    return 0;
  }

  /**
   * Store temporary data related to OAuth flow
   * 
   * @param key - Storage key
   * @param data - Data to store
   * @param ttlSeconds - Time to live in seconds
   */
  async storeTempData(key: string, data: any, ttlSeconds: number = 300): Promise<void> {
    const storageKey = `oauth_temp_${key}`;
    const value = JSON.stringify(data);
    
    await this.kv.put(storageKey, value, {
      expirationTtl: ttlSeconds
    });
  }

  /**
   * Retrieve temporary data related to OAuth flow
   * 
   * @param key - Storage key
   * @returns Stored data or null if not found
   */
  async getTempData(key: string): Promise<any | null> {
    const storageKey = `oauth_temp_${key}`;
    const data = await this.kv.get(storageKey);
    
    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to parse temp data:', { key, error });
      return null;
    }
  }

  /**
   * Delete temporary data
   * 
   * @param key - Storage key
   */
  async deleteTempData(key: string): Promise<void> {
    const storageKey = `oauth_temp_${key}`;
    await this.kv.delete(storageKey);
  }

  /**
   * Store OAuth session data
   * Used for maintaining OAuth session state across requests
   * 
   * @param sessionId - Unique session identifier
   * @param sessionData - Session data to store
   * @param ttlSeconds - Time to live in seconds (default: 1 hour)
   */
  async storeOAuthSession(
    sessionId: string, 
    sessionData: any, 
    ttlSeconds: number = 3600
  ): Promise<void> {
    const key = `oauth_session_${sessionId}`;
    const value = JSON.stringify({
      ...sessionData,
      createdAt: Date.now()
    });
    
    await this.kv.put(key, value, {
      expirationTtl: ttlSeconds
    });
  }

  /**
   * Retrieve OAuth session data
   * 
   * @param sessionId - Unique session identifier
   * @returns Session data or null if not found
   */
  async getOAuthSession(sessionId: string): Promise<any | null> {
    const key = `oauth_session_${sessionId}`;
    const data = await this.kv.get(key);
    
    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to parse OAuth session:', { sessionId, error });
      return null;
    }
  }

  /**
   * Delete OAuth session data
   * 
   * @param sessionId - Unique session identifier
   */
  async deleteOAuthSession(sessionId: string): Promise<void> {
    const key = `oauth_session_${sessionId}`;
    await this.kv.delete(key);
  }
}
