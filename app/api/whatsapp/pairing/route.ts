/**
 * WhatsApp Pairing Code Request
 * POST /api/whatsapp/pairing
 *
 * Requests a pairing code for phone number-based WhatsApp authentication.
 * Alternative to QR code authentication for linking devices.
 */

import {
  requireAuth,
  successResponse,
  withErrorHandler,
  validateRequest,
} from '@/lib/api';
import { whatsAppPairingSchema } from '@/lib/api/schemas';
import { requestPairingCode } from '@/lib/integrations/baileys';
import { OrganizationsRepository } from '@/lib/infrastructure/repositories';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/shared/utils';

export const dynamic = 'force-dynamic';

export const POST = withErrorHandler(async (request: Request) => {
  // 1. Authenticate user
  const user = await requireAuth();

  // 2. Validate request body
  const { phoneNumber } = await validateRequest(request, whatsAppPairingSchema);

  // 3. Initialize repository
  const orgsRepo = new OrganizationsRepository(supabaseAdmin);

  // 4. Get user's organization
  const org = await orgsRepo.getByOwnerId(user.id);

  if (!org) {
    throw new Error('Organization not found');
  }

  // 5. Request pairing code from Baileys
  const code = await requestPairingCode(org.id, phoneNumber);

  logger.info('WhatsApp pairing code requested', {
    userId: user.id,
    orgId: org.id,
    phoneNumber,
  });

  // 6. Return pairing code
  return successResponse({ code });
});