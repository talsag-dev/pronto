/**
 * WhatsApp Cloud API OAuth Callback
 * GET /api/auth/whatsapp/callback
 *
 * Handles OAuth callback from Meta/WhatsApp after user authorizes business integration.
 * Exchanges code for access token, retrieves business account details, and saves configuration.
 * Redirects user back to settings page with success/error status.
 */

import { NextResponse } from 'next/server';
import { validateQuery } from '@/lib/api';
import { oauthCallbackSchema } from '@/lib/api/schemas';
import {
  exchangeCodeForToken,
  getWhatsAppBusinessAccount,
} from '@/lib/integrations/whatsapp-cloud';
import { OrganizationsRepository } from '@/lib/infrastructure/repositories';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/shared/utils';

export async function GET(request: Request) {
  const BASE_REDIRECT_URL = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/whatsapp`;

  try {
    // 1. Validate query parameters
    const { searchParams } = new URL(request.url);
    const { code, state: orgId } = validateQuery(
      searchParams,
      oauthCallbackSchema
    );

    logger.info('WhatsApp OAuth callback received', { orgId });

    // 2. Exchange authorization code for access token
    const accessToken = await exchangeCodeForToken(code);

    // 3. Get WhatsApp Business Account details (optional for test mode)
    const wabaDetails = await getWhatsAppBusinessAccount(accessToken);

    let phoneId: string;
    let businessId: string;
    let phoneNumber: string;

    if (wabaDetails?.phone_numbers?.[0]) {
      // Production mode: Use actual business phone
      const phone = wabaDetails.phone_numbers[0];
      phoneId = phone.id;
      businessId = wabaDetails.id;
      phoneNumber = phone.display_phone_number;
    } else {
      // Test mode: Use placeholder (manually set phone_id later)
      phoneId = 'test_phone_id';
      businessId = 'test_business_id';
      phoneNumber = 'Test Number';
    }

    // 4. Initialize repository and save WhatsApp integration
    const orgsRepo = new OrganizationsRepository(supabaseAdmin);

    // Update organization with WhatsApp details (using direct update since we need custom fields)
    await supabaseAdmin
      .from('organizations')
      .update({
        whatsapp_access_token: accessToken,
        whatsapp_phone_id: phoneId,
        whatsapp_business_id: businessId,
        whatsapp_phone_number: phoneNumber,
      })
      .eq('id', orgId);

    logger.info('WhatsApp integration saved', {
      orgId,
      phoneId,
      phoneNumber,
    });

    // 5. Redirect back to settings with success
    return NextResponse.redirect(`${BASE_REDIRECT_URL}?success=true`);
  } catch (error) {
    logger.error('WhatsApp OAuth callback error', { error });

    // Redirect back to settings with error
    return NextResponse.redirect(`${BASE_REDIRECT_URL}?error=oauth_failed`);
  }
}
