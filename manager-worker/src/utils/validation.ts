import { ValidationRule, ValidationResult } from '../types/index.js';

/**
 * Validate request data against rules
 */
export function validateData(data: any, rules: ValidationRule[]): ValidationResult {
  const errors: string[] = [];

  for (const rule of rules) {
    const value = data[rule.field];
    const fieldErrors = validateField(value, rule);
    errors.push(...fieldErrors);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate a single field against a rule
 */
function validateField(value: any, rule: ValidationRule): string[] {
  const errors: string[] = [];
  const { field, required, type, minLength, maxLength, pattern } = rule;

  // Check if field is required
  if (required && (value === undefined || value === null || value === '')) {
    errors.push(`${field} is required`);
    return errors;
  }

  // Skip further validation if field is not provided and not required
  if (value === undefined || value === null || value === '') {
    return errors;
  }

  // Type validation
  if (type) {
    switch (type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push(`${field} must be a string`);
        }
        break;
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          errors.push(`${field} must be a valid number`);
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push(`${field} must be a boolean`);
        }
        break;
      case 'email':
        if (typeof value !== 'string' || !isValidEmail(value)) {
          errors.push(`${field} must be a valid email address`);
        }
        break;
      case 'uuid':
        if (typeof value !== 'string' || !isValidUUID(value)) {
          errors.push(`${field} must be a valid UUID`);
        }
        break;
    }
  }

  // String-specific validations
  if (typeof value === 'string') {
    // Length validation
    if (minLength !== undefined && value.length < minLength) {
      errors.push(`${field} must be at least ${minLength} characters long`);
    }
    if (maxLength !== undefined && value.length > maxLength) {
      errors.push(`${field} must be no more than ${maxLength} characters long`);
    }

    // Pattern validation
    if (pattern && !pattern.test(value)) {
      errors.push(`${field} format is invalid`);
    }
  }

  return errors;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): ValidationResult {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate username format
 */
export function validateUsername(username: string): ValidationResult {
  const errors: string[] = [];

  if (username.length < 3) {
    errors.push('Username must be at least 3 characters long');
  }

  if (username.length > 30) {
    errors.push('Username must be no more than 30 characters long');
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, underscores, and hyphens');
  }

  if (/^[_-]/.test(username) || /[_-]$/.test(username)) {
    errors.push('Username cannot start or end with underscore or hyphen');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

/**
 * Validate token name
 */
export function validateTokenName(name: string): ValidationResult {
  const errors: string[] = [];

  if (!name || name.trim().length === 0) {
    errors.push('Token name is required');
  }

  if (name.length > 100) {
    errors.push('Token name must be no more than 100 characters long');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate token value
 */
export function validateTokenValue(value: string): ValidationResult {
  const errors: string[] = [];

  if (!value || value.trim().length === 0) {
    errors.push('Token value is required');
  }

  if (value.length > 1000) {
    errors.push('Token value must be no more than 1000 characters long');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate date string (ISO format)
 */
export function validateDateString(dateString: string): ValidationResult {
  const errors: string[] = [];

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      errors.push('Invalid date format');
    } else if (date < new Date()) {
      errors.push('Date cannot be in the past');
    }
  } catch {
    errors.push('Invalid date format');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate array of strings
 */
export function validateStringArray(
  array: any,
  fieldName: string,
  maxItems?: number
): ValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(array)) {
    errors.push(`${fieldName} must be an array`);
    return { isValid: false, errors };
  }

  if (maxItems && array.length > maxItems) {
    errors.push(`${fieldName} cannot have more than ${maxItems} items`);
  }

  for (let i = 0; i < array.length; i++) {
    if (typeof array[i] !== 'string') {
      errors.push(`${fieldName}[${i}] must be a string`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Common validation rules
 */
export const ValidationRules = {
  // Login validation
  login: [
    { field: 'username', required: true, type: 'string' as const, minLength: 3, maxLength: 30 },
    { field: 'password', required: true, type: 'string' as const, minLength: 8 },
  ],

  // Token creation validation
  createToken: [
    { field: 'name', required: true, type: 'string' as const, minLength: 1, maxLength: 100 },
    { field: 'value', required: true, type: 'string' as const, minLength: 1, maxLength: 1000 },
    { field: 'description', required: false, type: 'string' as const, maxLength: 500 },
    { field: 'category', required: false, type: 'string' as const, maxLength: 50 },
  ],

  // UUID creation validation
  createUuid: [
    { field: 'name', required: true, type: 'string' as const, minLength: 1, maxLength: 100 },
    { field: 'description', required: false, type: 'string' as const, maxLength: 500 },
    { field: 'category', required: false, type: 'string' as const, maxLength: 50 },
  ],

  // Activation code creation validation
  createActivationCode: [
    { field: 'name', required: true, type: 'string' as const, minLength: 1, maxLength: 100 },
    { field: 'description', required: false, type: 'string' as const, maxLength: 500 },
    { field: 'maxUses', required: true, type: 'number' as const },
  ],

  // Email subscription validation
  emailSubscription: [
    { field: 'email', required: true, type: 'email' as const },
    { field: 'name', required: false, type: 'string' as const, maxLength: 100 },
  ],
};
