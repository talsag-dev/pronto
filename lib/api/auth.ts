/**
 * API Authentication Utilities
 *
 * Provides helpers for authentication and authorization in API routes.
 * Centralizes auth logic that was previously duplicated across routes.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

/**
 * Get the authenticated user from the request
 * Uses Supabase SSR for cookie-based auth
 */
export async function getAuthenticatedUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
            // Cookie setting might fail in certain contexts
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Get the authenticated user's organization
 * Returns null if user doesn't have an organization
 */
export async function getUserOrganization(
  userId: string
): Promise<{ id: string } | null> {
  const { data } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('owner_id', userId)
    .single();

  return data;
}

/**
 * Verify that the user owns the specified organization
 * Returns true if user is the owner, false otherwise
 */
export async function verifyOrganizationOwnership(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('id', organizationId)
    .eq('owner_id', userId)
    .single();

  return !!data;
}

/**
 * Require authentication - throws if user is not authenticated
 * Returns the authenticated user
 */
export async function requireAuth(): Promise<User> {
  const user = await getAuthenticatedUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

/**
 * Require organization ownership - throws if user doesn't own the org
 * Returns the user and organization ID
 */
export async function requireOrganizationOwnership(
  organizationId: string
): Promise<{ user: User; organizationId: string }> {
  const user = await requireAuth();
  const hasAccess = await verifyOrganizationOwnership(
    user.id,
    organizationId
  );

  if (!hasAccess) {
    throw new Error('Forbidden');
  }

  return { user, organizationId };
}

/**
 * Check if user is an admin
 * Compares user email against ADMIN_EMAIL environment variable
 */
export function isAdmin(user: User): boolean {
  const adminEmail = process.env.ADMIN_EMAIL || 'talsagie19@gmail.com';
  return user.email === adminEmail;
}

/**
 * Require admin access - throws if user is not an admin
 * Returns the authenticated admin user
 */
export async function requireAdmin(): Promise<User> {
  const user = await requireAuth();
  if (!isAdmin(user)) {
    throw new Error('Forbidden');
  }
  return user;
}
