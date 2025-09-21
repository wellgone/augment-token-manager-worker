/**
 * Crypto Utilities for OAuth Module
 * 
 * This module provides cryptographic functions for OAuth 2.0 PKCE flow
 * using Web Crypto API, replacing Rust's crypto functions.
 */

/**
 * Crypto utilities class
 * Replaces Rust's crypto functions with Web Crypto API
 */
export class CryptoUtils {
  
  /**
   * Generate random bytes - exact copy of Rust's generate_random_bytes
   *
   * @param length - Number of bytes to generate
   * @returns Uint8Array of random bytes
   */
  generateRandomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
  }

  /**
   * Generate code verifier for PKCE - exact copy of Rust logic
   * Creates 32 random bytes, then base64url encodes them
   */
  generateCodeVerifier(): string {
    // 生成32字节的随机代码验证器 (same as Rust)
    const codeVerifierBytes = this.generateRandomBytes(32);
    return this.base64UrlEncodeBytes(codeVerifierBytes);
  }

  /**
   * Generate state parameter for CSRF protection - exact copy of Rust logic
   * Creates 8 random bytes, then base64url encodes them
   */
  generateState(): string {
    // 生成状态参数用于防止CSRF攻击 (same as Rust)
    const stateBytes = this.generateRandomBytes(8);
    return this.base64UrlEncodeBytes(stateBytes);
  }

  /**
   * SHA256 hash function
   * Replaces Rust's sha256_hash function
   * 
   * @param plain - Plain text to hash
   * @returns Base64URL encoded SHA256 hash
   */
  async sha256(plain: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return this.base64UrlEncode(hash);
  }

  /**
   * Base64URL encoding
   * Replaces Rust's base64_url_encode function
   * 
   * @param arrayBuffer - Data to encode
   * @returns Base64URL encoded string
   */
  base64UrlEncode(arrayBuffer: ArrayBuffer): string {
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Base64URL encoding for Uint8Array
   * Helper function for encoding byte arrays
   * 
   * @param bytes - Uint8Array to encode
   * @returns Base64URL encoded string
   */
  base64UrlEncodeBytes(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Generate PKCE code challenge from verifier
   * 
   * @param codeVerifier - The code verifier string
   * @returns Base64URL encoded SHA256 hash of the verifier
   */
  async generateCodeChallenge(codeVerifier: string): Promise<string> {
    return await this.sha256(codeVerifier);
  }

  /**
   * Validate code verifier format
   * Ensures the code verifier meets PKCE requirements
   * 
   * @param codeVerifier - Code verifier to validate
   * @returns True if valid, false otherwise
   */
  validateCodeVerifier(codeVerifier: string): boolean {
    // PKCE code verifier must be 43-128 characters
    if (codeVerifier.length < 43 || codeVerifier.length > 128) {
      return false;
    }

    // Must contain only unreserved characters
    const validChars = /^[A-Za-z0-9\-._~]+$/;
    return validChars.test(codeVerifier);
  }

// Removed duplicate generateRandomBytes - already defined above

// Removed createOAuthParameters - using createOAuthState in core.ts instead
}
