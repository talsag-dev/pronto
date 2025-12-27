/**
 * WhatsApp Session Management
 * DELETE /api/whatsapp/session
 *
 * Terminates the WhatsApp session for the user's organization.
 * Closes the socket connection, clears memory, and deletes database session data.
 */

import {
  requireAuth,
  successResponse,
  withErrorHandler,
} from '@/lib/api';
import { logoutSession } from '@/lib/integrations/baileys';
import { OrganizationsRepository } from '@/lib/infrastructure/repositories';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/shared/utils';

export const dynamic = 'force-dynamic';

export const DELETE = withErrorHandler(async (request: Request) => {
  // 1. Authenticate user
  const user = await requireAuth();

  // 2. Initialize repository
  const orgsRepo = new OrganizationsRepository(supabaseAdmin);

  // 3. Get user's organization
  const org = await orgsRepo.getByOwnerId(user.id);

  if (!org) {
    throw new Error('Organization not found');
  }

  // 4. Terminate the session (closes socket, clears memory, deletes DB data)
  await logoutSession(org.id);

  logger.info('WhatsApp session terminated', {
    userId: user.id,
    orgId: org.id,
  });

  // 5. Return success response
  return successResponse({
    success: true,
    message: 'Session terminated successfully.',
  });
});
