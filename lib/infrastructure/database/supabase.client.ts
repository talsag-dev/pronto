/**
 * Supabase Client Singleton
 *
 * Provides centralized access to Supabase clients, eliminating repeated
 * createClient() calls throughout the codebase.
 *
 * Usage:
 *   Server-side: supabaseAdmin() - Uses service role key for full access
 *   Client-side: supabaseBrowser() - Uses anon key with RLS
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/shared/types';
import { env } from '@/lib/shared/config';
import { logger } from '@/lib/shared/utils';

// ============================================================================
// Admin Client (Server-side only)
// ============================================================================

let adminClientInstance: SupabaseClient<Database> | null = null;

/**
 * Get or create Supabase admin client (server-side only).
 * Uses service role key for full database access bypassing RLS.
 *
 * IMPORTANT: Only use in API routes or server components.
 * Never expose to client-side code.
 */
export function supabaseAdmin(): SupabaseClient<Database> {
  if (!adminClientInstance) {
    adminClientInstance = createClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    logger.info('Supabase admin client initialized');
  }

  return adminClientInstance;
}

// ============================================================================
// Server Client (SSR with cookies)
// ============================================================================

/**
 * Create Supabase client for server-side rendering with cookie-based auth.
 * Use this in Server Components and Server Actions.
 */
export async function supabaseServer() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component - can't mutate cookies
          }
        },
      },
    }
  );
}

// ============================================================================
// Browser Client (Client Components)
// ============================================================================

let browserClientInstance: SupabaseClient<Database> | null = null;

/**
 * Get or create Supabase browser client (client-side only).
 * Uses anon key with Row Level Security (RLS).
 *
 * Use this in Client Components and client-side logic.
 */
export function supabaseBrowser(): SupabaseClient<Database> {
  if (typeof window === 'undefined') {
    throw new Error('supabaseBrowser() can only be used in browser environment');
  }

  if (!browserClientInstance) {
    browserClientInstance = createBrowserClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }

  return browserClientInstance;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get current authenticated user from server context
 */
export async function getCurrentUser() {
  const supabase = await supabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    logger.error('Failed to get current user', error);
    return null;
  }

  return user;
}

/**
 * Get current user's organization ID
 */
export async function getCurrentOrgId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)
    .single<{ id: string }>();

  if (error) {
    logger.error('Failed to get user organization', error);
    return null;
  }

  return data?.id || null;
}
