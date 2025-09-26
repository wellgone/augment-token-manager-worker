import { Env } from '../types/index.js';
import { getTwoRandomWords, getRandomNumber } from '../utils/wordManager.js';

/**
 * Email Service for managing temporary email generation and verification code retrieval
 * This service provides integration points for the email worker functionality
 */
export class EmailService {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Get available email domains
   * 获取可用的邮箱域名列表
   */
  async getAvailableDomains(): Promise<string[]> {
    try {
      // 优先从环境变量读取域名配置
      if (this.env.EMAIL_DOMAINS) {
        if (Array.isArray(this.env.EMAIL_DOMAINS)) {
          return this.env.EMAIL_DOMAINS;
        }
        // Handle string format: "domain1,domain2,domain3"
        if (typeof this.env.EMAIL_DOMAINS === 'string') {
          return this.env.EMAIL_DOMAINS.split(',').map(d => d.trim());
        }
      }

      // 如果没有配置环境变量，返回示例域名
      return [
        'mail.example.com',
        'email.example.com'
      ];
    } catch (error) {
      console.error('Failed to get available domains:', error);
      return ['example.com']; // Fallback domain
    }
  }

  /**
   * Generate a random email address
   * Integration point for email worker's email generation
   * Enhanced to support custom domains from frontend
   */
  async generateRandomEmail(options: {
    type?: 'mixed' | 'word' | 'twowords';
    prefix?: string;
    length?: number;
    domain?: string;
    customDomain?: string; // New: support for custom domain input
  }): Promise<{
    email: string;
    domain: string;
    availableDomains: string[];
    success: boolean;
    error?: string;
  }> {
    try {
      const { type = 'mixed', prefix = '', length = 0, domain: customDomain = '', customDomain: userCustomDomain = '' } = options;

      // Get available domains
      const availableDomains = await this.getAvailableDomains();

      // Select domain with priority: userCustomDomain > customDomain > random from available
      let selectedDomain = '';
      if (userCustomDomain && userCustomDomain.trim()) {
        // Validate custom domain format
        if (this.isValidDomain(userCustomDomain.trim())) {
          selectedDomain = userCustomDomain.trim();
        } else {
          return {
            email: '',
            domain: '',
            availableDomains,
            success: false,
            error: 'Invalid custom domain format'
          };
        }
      } else if (customDomain && customDomain.trim()) {
        selectedDomain = customDomain.trim();
      } else {
        selectedDomain = this.getRandomDomain(availableDomains);
      }

      // Generate email
      const email = this.generateEmailLocalPart(type, prefix, length, selectedDomain);

      return {
        email,
        domain: selectedDomain,
        availableDomains,
        success: true
      };
    } catch (error) {
      return {
        email: '',
        domain: '',
        availableDomains: [],
        success: false,
        error: `Failed to generate email: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get verification code from external email service
   * Integration point for email worker's verification code retrieval
   */
  async getVerificationCode(emailAddress?: string): Promise<{
    success: boolean;
    recipientEmail?: string;
    verificationCode?: string;
    timestamp?: string;
    error?: string;
  }> {
    try {
      // Check if email service is configured
      const baseUrl = this.env.EMAIL_API_BASE_URL;
      const authToken = this.env.EMAIL_API_TOKEN;

      if (!baseUrl || !authToken) {
        return {
          success: false,
          error: 'Email service not configured. Please set EMAIL_API_BASE_URL and EMAIL_API_TOKEN in your configuration.'
        };
      }

      // Build API URL with hardcoded path
      const apiPath = '/api/allEmail/list';
      const url = new URL(apiPath, baseUrl);

      // Set default query parameters
      url.searchParams.set('emailId', '0');
      url.searchParams.set('size', '1');
      url.searchParams.set('timeSort', '0');
      url.searchParams.set('type', 'receive');
      url.searchParams.set('searchType', 'name');

      // If specific email address is provided, add it to the search
      if (emailAddress) {
        url.searchParams.set('searchValue', emailAddress);
      }

      const apiUrl = url.toString();

      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': authToken
        }
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch emails from external service: ${response.status} ${response.statusText}`
        };
      }

      const data = await response.json() as any;

      // Process email data and extract verification code
      if (data.code !== 200 || !data.data || !data.data.list) {
        return {
          success: false,
          error: 'Invalid email data format'
        };
      }

      const latestEmail = data.data.list[0];
      if (!latestEmail) {
        return {
          success: false,
          error: 'No emails found'
        };
      }

      // Check if email is within 2 hours (more lenient for timezone issues)
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;

      // Handle different time formats - assume UTC if no timezone specified
      let emailTime: number;
      if (latestEmail.createTime.includes('T') || latestEmail.createTime.includes('Z')) {
        // ISO format with timezone
        emailTime = new Date(latestEmail.createTime).getTime();
      } else {
        // Assume UTC time format like "2025-09-21 04:18:21"
        emailTime = new Date(latestEmail.createTime + ' UTC').getTime();
      }



      if (emailTime < twoHoursAgo) {
        return {
          success: false,
          error: `No emails found within the last 2 hours. Latest email is ${Math.round((Date.now() - emailTime) / (1000 * 60))} minutes old.`
        };
      }

      // Extract verification code
      const verificationCode = this.extractVerificationCode(latestEmail);

      return {
        success: true,
        recipientEmail: latestEmail.toEmail,
        verificationCode: verificationCode || undefined,
        timestamp: latestEmail.createTime
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to get verification code: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Extract verification code from email content
   * Private helper method for processing email content
   */
  private extractVerificationCode(email: any): string | null {
    const content = (email.content || email.text || '').toLowerCase();

    // Look for "Your verification code is:" format
    const verificationMatch = content.match(/your verification code is[:：]\s*(\d{4,6})/i);
    if (verificationMatch) {
      return verificationMatch[1];
    }

    // Fallback: look for standalone 6-digit numbers
    const codeMatch = content.match(/\b(\d{6})\b/g);
    if (codeMatch) {
      // Return the last 6-digit number (usually the verification code)
      return codeMatch[codeMatch.length - 1];
    }

    return null;
  }

  /**
   * Generate email local part based on type
   * Private helper method for email generation
   */
  private generateEmailLocalPart(type: string, prefix: string, length: number, domain: string): string {
    if (!length || length === 0) {
      length = Math.floor(Math.random() * 8) + 8;
    } else {
      length = Math.max(8, Math.min(15, length));
    }

    let localPart = '';

    switch (type) {
      case 'mixed':
        localPart = this.generateRandomLocalPart(length);
        break;
      case 'word':
        localPart = this.generateWordBasedEmail(prefix, length);
        break;
      case 'twowords':
        localPart = this.generateTwoWordsEmail();
        break;
      default:
        localPart = this.generateRandomLocalPart(length);
    }

    return `${localPart}@${domain}`;
  }

  /**
   * Generate random local part with letters and numbers
   * Private helper method
   */
  private generateRandomLocalPart(length: number): string {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';

    let result = '';
    let digitCount = 0;
    const minDigits = 2;

    // Start with a letter
    result += letters.charAt(Math.floor(Math.random() * letters.length));

    // Generate middle characters
    const middleLength = length - 2;
    const digitPositions: number[] = [];
    const numDigitsToPlace = Math.max(minDigits, Math.floor(Math.random() * Math.min(middleLength, 4)) + minDigits);

    // Select random positions for digits
    while (digitPositions.length < Math.min(numDigitsToPlace, middleLength)) {
      const pos = Math.floor(Math.random() * middleLength) + 1;
      if (!digitPositions.includes(pos)) {
        digitPositions.push(pos);
      }
    }

    // Fill middle characters
    for (let i = 1; i < length - 1; i++) {
      if (digitPositions.includes(i)) {
        result += numbers.charAt(Math.floor(Math.random() * numbers.length));
        digitCount++;
      } else {
        result += letters.charAt(Math.floor(Math.random() * letters.length));
      }
    }

    // End with a letter
    if (length > 1) {
      result += letters.charAt(Math.floor(Math.random() * letters.length));
    }

    return result;
  }

  /**
   * Generate word-based email
   * Private helper method
   */
  private generateWordBasedEmail(prefix: string, length: number): string {
    const words = ['happy', 'lucky', 'smart', 'quick', 'bright', 'cool', 'fast', 'nice', 'super', 'magic'];
    const word = words[Math.floor(Math.random() * words.length)];
    const numbers = '0123456789';

    let base = prefix ? prefix + word : word;
    
    // Ensure length meets requirements
    if (base.length < length) {
      const remaining = length - base.length;
      for (let i = 0; i < remaining; i++) {
        if (i < remaining / 2) {
          base += numbers.charAt(Math.floor(Math.random() * numbers.length));
        } else {
          base += 'abcdefghijklmnopqrstuvwxyz'.charAt(Math.floor(Math.random() * 26));
        }
      }
    } else if (base.length > length) {
      base = base.substring(0, length);
    }

    return base.toLowerCase();
  }

  /**
   * Generate two-words based email with random connector and optional number
   * Private helper method for twowords type email generation
   * Formats: word1word2, word1_word2, word1-word2, word1word2123, word1_word2123, word1-word2123
   */
  private generateTwoWordsEmail(): string {
    try {
      // Get two different random words (3-6 letters each)
      const [word1, word2] = getTwoRandomWords();

      // Random connector selection (no digit separators)
      const connectors = ['', '_', '-'];
      const connector = connectors[Math.floor(Math.random() * connectors.length)];

      // Random decision: 60% chance to add number at the end
      const addNumber = Math.random() < 0.6;
      let numberSuffix = '';

      if (addNumber) {
        // Get random 2-3 digit number
        const number = getRandomNumber();
        numberSuffix = number.toString();
      }

      // Combine: word1[connector]word2[number]
      return `${word1}${connector}${word2}${numberSuffix}`;
    } catch (error) {
      console.error('Failed to generate two-words email, falling back to simple generation:', error);

      // Fallback to simple word + number generation
      const fallbackWords = ['happy', 'lucky', 'smart', 'quick', 'bright', 'cool'];
      const word1 = fallbackWords[Math.floor(Math.random() * fallbackWords.length)];
      const word2 = fallbackWords[Math.floor(Math.random() * fallbackWords.length)];

      // Random connector for fallback too
      const connectors = ['', '_', '-'];
      const connector = connectors[Math.floor(Math.random() * connectors.length)];

      // Random number suffix for fallback
      const addNumber = Math.random() < 0.6;
      const numberSuffix = addNumber ? (Math.floor(Math.random() * 900) + 100).toString() : '';

      return `${word1}${connector}${word2}${numberSuffix}`;
    }
  }

  /**
   * Get random domain from available domains
   * Private helper method
   */
  private getRandomDomain(domains: string[]): string {
    return domains[Math.floor(Math.random() * domains.length)];
  }

  /**
   * Validate domain format
   * Private helper method for custom domain validation
   */
  private isValidDomain(domain: string): boolean {
    // Basic domain validation regex
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(domain) && domain.length <= 253;
  }
}
