import { Env } from '../types/index.js';
import { EmailService } from '../services/emailService.js';
import { createSuccessResponse, createErrorResponse } from '../utils/response.js';

/**
 * Email route handlers for temporary email generation and verification code retrieval
 * These handlers provide integration points for the email worker functionality
 */

/**
 * Get available email domains
 * GET /api/email/domains
 */
export async function getEmailDomainsHandler(request: Request, env: Env): Promise<Response> {
  try {
    const emailService = new EmailService(env);
    const domains = await emailService.getAvailableDomains();
    
    return createSuccessResponse({ domains });
  } catch (error) {
    console.error('Failed to get email domains:', error);
    return createErrorResponse('Failed to get email domains', 500);
  }
}

/**
 * Generate a random email address
 * POST /api/email/generate
 *
 * Request body:
 * {
 *   "type": "mixed" | "word",     // Optional, default: "mixed"
 *   "prefix": "string",           // Optional
 *   "length": number,             // Optional, 0 for random
 *   "domain": "string",           // Optional, uses random if not provided
 *   "customDomain": "string"      // Optional, custom domain input from frontend
 * }
 */
export async function generateEmailHandler(request: Request, env: Env): Promise<Response> {
  try {
    const emailService = new EmailService(env);

    // Parse request body
    let options = {};
    try {
      const body = await request.text();
      if (body) {
        options = JSON.parse(body);
      }
    } catch (parseError) {
      return createErrorResponse('Invalid JSON in request body', 400);
    }

    const result = await emailService.generateRandomEmail(options);

    // Check if email generation was successful
    if (!result.success) {
      return createErrorResponse(result.error || 'Failed to generate email', 400);
    }

    return createSuccessResponse({
      email: result.email,
      domain: result.domain,
      availableDomains: result.availableDomains
    });
  } catch (error) {
    console.error('Failed to generate email:', error);
    return createErrorResponse('Failed to generate email', 500);
  }
}

/**
 * Get verification code from external email service
 * GET /api/email/verification-code?email=example@domain.com
 */
export async function getVerificationCodeHandler(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const emailAddress = url.searchParams.get('email');

    const emailService = new EmailService(env);
    const result = await emailService.getVerificationCode(emailAddress || undefined);

    // Return the result directly since EmailService already provides the correct structure
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Failed to get verification code:', error);
    return new Response(JSON.stringify({
      success: false,
      error: `Failed to get verification code: ${error instanceof Error ? error.message : 'Unknown error'}`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Health check for email service
 * GET /api/email/health
 */
export async function emailHealthHandler(request: Request, env: Env): Promise<Response> {
  try {
    const emailService = new EmailService(env);
    const domains = await emailService.getAvailableDomains();
    
    // Check if email API configuration is available
    const hasEmailApiConfig = !!(env.EMAIL_API_BASE_URL && env.EMAIL_API_TOKEN);
    
    return createSuccessResponse({
      status: 'healthy',
      availableDomains: domains.length,
      emailApiConfigured: hasEmailApiConfig,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Email service health check failed:', error);
    return createErrorResponse('Email service health check failed', 500);
  }
}
