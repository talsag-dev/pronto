/**
 * Admin Status Dashboard
 * GET /api/admin/status
 *
 * Returns status of all organizations with WhatsApp connection details.
 * Admin-only endpoint that shows connected phone numbers and session data.
 */

import {
  requireAdmin,
  successResponse,
  withErrorHandler,
} from '@/lib/api';
import { OrganizationsRepository } from '@/lib/infrastructure/repositories';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/shared/utils';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandler(async (request: Request) => {
  // 1. Require admin authentication
  await requireAdmin();

  // 2. Initialize repository
  const orgsRepo = new OrganizationsRepository(supabaseAdmin);

  // 3. Get all organizations
  const orgs = await orgsRepo.listAll();

  // 4. Get WhatsApp session data to find actual connected phone
  const { data: sessions } = await supabaseAdmin
    .from('whatsapp_sessions')
    .select('session_id, key, value');

  // 5. Map session data to organizations
  const orgsWithSessionData = orgs.map((org) => {
    const orgSessions = sessions?.filter((s) => s.session_id === org.id) || [];

    // Try to find the phone number from session data (stored in creds)
    const credsSession = orgSessions.find((s) => s.key === 'creds');
    let connectedPhone = org.business_phone;

    if (credsSession?.value) {
      try {
        const creds = JSON.parse(credsSession.value);
        // Baileys stores the phone in creds.me.id
        if (creds?.me?.id) {
          connectedPhone = creds.me.id.split(':')[0]; // Format: "1234567890:XX@s.whatsapp.net"
        }
      } catch (e) {
        logger.warn('Failed to parse WhatsApp session credentials', {
          orgId: org.id,
          error: e,
        });
      }
    }

    return {
      id: org.id,
      name: org.name,
      whatsapp_status: org.whatsapp_status,
      business_phone: org.business_phone,
      connected_phone: connectedPhone,
      has_session_data: orgSessions.length > 0,
    };
  });

  logger.info('Admin status dashboard accessed', {
    organizationCount: orgsWithSessionData.length,
  });

  // 6. Return success response
  return successResponse({
    organizations: orgsWithSessionData,
  });
});
