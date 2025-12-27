/**
 * WhatsApp QR Code (Baileys)
 * GET /api/whatsapp/qr-baileys
 *
 * Generates a QR code for WhatsApp authentication using Baileys library.
 * Ensures worker session is initialized and returns QR code as data URL.
 */

import {
  requireAuth,
  successResponse,
  withErrorHandler,
  commonErrors,
} from '@/lib/api';
import { getQRCode, ensureWorkerSession } from '@/lib/integrations/baileys';
import { OrganizationsRepository } from '@/lib/infrastructure/repositories';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/shared/utils';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandler(async (request: Request) => {
  // 1. Authenticate user
  const user = await requireAuth();

  // 2. Initialize repository
  const orgsRepo = new OrganizationsRepository(supabaseAdmin);

  // 3. Get user's organization
  const org = await orgsRepo.getByOwnerId(user.id);

  if (!org) {
    throw new Error('Organization not found');
  }

  // 4. Ensure session is initialized on worker
  await ensureWorkerSession(org.id);

  logger.info('Baileys worker session ensured', {
    userId: user.id,
    orgId: org.id,
  });

  // 5. Get QR data from Baileys (Worker already returns Data URL)
  const qrData = await getQRCode(org.id);

  if (!qrData) {
    return commonErrors.notFound('QR code');
  }

  // 6. Convert to base64 image ONLY if it's not already a data URL
  // (Prevents "data too big" error when worker already converted it)
  const qrImage = qrData.startsWith('data:image')
    ? qrData
    : await QRCode.toDataURL(qrData);

  logger.info('QR code generated', {
    userId: user.id,
    orgId: org.id,
  });

  // 7. Return QR code
  return successResponse({ qr: qrImage });
});
