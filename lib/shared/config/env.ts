/**
 * Type-safe environment configuration
 *
 * This module provides a single source of truth for all environment variables.
 * It validates required variables at runtime and provides TypeScript types.
 *
 * Usage:
 *   import { env } from '@/lib/shared/config/env';
 *   const url = env.NEXT_PUBLIC_SUPABASE_URL;
 */

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];

  if (!value) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function getOptionalEnvVar(key: string, defaultValue?: string): string {
  return process.env[key] || defaultValue || '';
}

// Public environment variables (available in browser)
export const env = {
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: getEnvVar('NEXT_PUBLIC_SUPABASE_URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: getEnvVar('SUPABASE_SERVICE_ROLE_KEY'),

  // OpenAI
  OPENAI_API_KEY: getEnvVar('OPENAI_API_KEY'),

  // Mixpanel
  MIXPANEL_TOKEN: getEnvVar('MIXPANEL_TOKEN'),

  // WhatsApp Worker
  WHATSAPP_WORKER_URL: getOptionalEnvVar('WHATSAPP_WORKER_URL', 'http://localhost:4000'),
  WORKER_SECRET: getOptionalEnvVar('WORKER_SECRET', 'dev-secret'),

  // App Configuration
  NODE_ENV: getOptionalEnvVar('NODE_ENV', 'development'),
  PORT: getOptionalEnvVar('PORT', '3001'),
} as const;

// Type for the env object
export type Env = typeof env;

/**
 * Validates that all required environment variables are present
 * Call this at application startup
 */
export function validateEnv(): void {
  try {
    // This will throw if any required variables are missing
    const _validated = env;
    console.log('✅ Environment variables validated successfully');
  } catch (error) {
    console.error('❌ Environment validation failed:', error);
    throw error;
  }
}
