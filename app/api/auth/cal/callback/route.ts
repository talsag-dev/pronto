/**
 * Cal.com OAuth Callback
 * GET /api/auth/cal/callback
 *
 * Handles OAuth callback from Cal.com after user authorizes calendar integration.
 * Exchanges authorization code for access/refresh tokens and saves to organization.
 */

import {
  successResponse,
  withErrorHandler,
  validateQuery,
} from '@/lib/api';
import { oauthCallbackSchema } from '@/lib/api/schemas';
import { OrganizationsRepository } from '@/lib/infrastructure/repositories';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/shared/utils';

export const GET = withErrorHandler(async (request: Request) => {
  // 1. Validate query parameters
  const { searchParams } = new URL(request.url);
  const { code, state: orgId } = validateQuery(
    searchParams,
    oauthCallbackSchema
  );

  logger.info('Cal.com OAuth callback received', { orgId });

  // 2. Exchange authorization code for access token
  const res = await fetch('https://api.cal.com/v1/oauth/tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: process.env.CAL_CLIENT_ID,
      client_secret: process.env.CAL_CLIENT_SECRET,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/cal/callback`,
      code,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    logger.error('Cal.com token exchange failed', {
      status: res.status,
      error: data,
      orgId,
    });
    throw new Error(`Failed to exchange token: ${JSON.stringify(data)}`);
  }

  const { access_token, refresh_token, user_id } = data;

  // 3. Initialize repository and update organization
  const orgsRepo = new OrganizationsRepository(supabaseAdmin);

  await orgsRepo.updateCalIntegration(orgId, {
    accessToken: access_token,
    refreshToken: refresh_token,
    userId: user_id,
  });

  logger.info('Cal.com integration saved', {
    orgId,
    userId: user_id,
  });

  // 4. Return success response
  return successResponse({
    success: true,
    message: 'Calendar connected successfully!',
  });
});
