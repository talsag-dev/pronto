/**
 * Check Admin Authorization
 * GET /api/admin/check-auth
 *
 * Checks if the currently authenticated user has admin privileges.
 * Returns { authorized: boolean } without throwing errors.
 */

import { getAuthenticatedUser, isAdmin } from '@/lib/api';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/shared/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Get authenticated user (don't throw if not authenticated)
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ authorized: false });
    }

    // 2. Check if user is admin
    const authorized = isAdmin(user);

    logger.info('Admin authorization check', {
      userId: user.id,
      email: user.email,
      authorized,
    });

    // 3. Return authorization status
    return NextResponse.json({ authorized });
  } catch (error) {
    logger.error('Admin authorization check failed', { error });
    return NextResponse.json({ authorized: false });
  }
}
