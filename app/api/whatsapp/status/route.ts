/**
 * WhatsApp Connection Status
 * GET /api/whatsapp/status
 *
 * Returns the WhatsApp connection status for the user's organization.
 * Checks if a phone ID is configured (indicates connection).
 */

import {
  requireAuth,
  successResponse,
  withErrorHandler,
} from '@/lib/api';
import { OrganizationsRepository } from '@/lib/infrastructure/repositories';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/shared/utils';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandler(async (request: Request) => {
  // 1. Authenticate user
  const user = await requireAuth();

  // 2. Initialize repository
  const orgsRepo = new OrganizationsRepository(supabaseAdmin);

  // 3. Get user's organization
  const org = await orgsRepo.getByOwnerId(user.id);

  if (!org) {
    logger.warn('User has no organization', { userId: user.id });
    return successResponse({
      connected: false,
      phoneNumber: null,
      orgId: null,
    });
  }

  // 4. Check connection status (using whatsapp_status field)
  const connected = org.whatsapp_status === 'connected';

  logger.info('WhatsApp status checked', {
    userId: user.id,
    orgId: org.id,
    connected,
    status: org.whatsapp_status,
  });

  // 5. Return status
  return successResponse({
    connected,
    phoneNumber: org.business_phone,
    orgId: org.id,
  });
});
