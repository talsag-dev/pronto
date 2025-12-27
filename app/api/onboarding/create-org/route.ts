/**
 * Create Organization During Onboarding
 * POST /api/onboarding/create-org
 *
 * Creates a new organization during the onboarding flow.
 * Generates a placeholder phone number until WhatsApp is connected.
 * Automatically registers a Baileys worker session for the organization.
 */

import {
  requireAuth,
  successResponse,
  withErrorHandler,
  validateRequest,
} from '@/lib/api';
import { onboardingCreateOrgSchema } from '@/lib/api/schemas';
import { OrganizationsRepository } from '@/lib/infrastructure/repositories';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/shared/utils';

export const dynamic = 'force-dynamic';

export const POST = withErrorHandler(async (request: Request) => {
  // 1. Authenticate user
  const user = await requireAuth();

  // 2. Validate request body
  const { businessName } = await validateRequest(
    request,
    onboardingCreateOrgSchema
  );

  // 3. Initialize repository
  const orgsRepo = new OrganizationsRepository(supabaseAdmin);

  // 4. Create organization with placeholder phone
  const org = await orgsRepo.createOrganization({
    name: businessName,
    businessPhone: `placeholder_${crypto.randomUUID()}`, // Placeholder until WhatsApp connected
    ownerId: user.id,
    config: {
      system_prompt: 'You are a helpful AI assistant for my business.',
      operating_hours: '09:00-18:00',
    },
    integrations: {},
  });

  logger.info('Organization created during onboarding', {
    orgId: org.id,
    userId: user.id,
    name: businessName,
  });

  // 5. Register Baileys worker session for the new organization
  try {
    const { ensureWorkerSession } = await import(
      '@/lib/integrations/baileys'
    );

    await ensureWorkerSession(org.id);

    logger.info('Baileys worker session registered', {
      orgId: org.id,
    });
  } catch (handlerError) {
    logger.error('Failed to register Baileys worker session', {
      orgId: org.id,
      error: handlerError,
    });
    // Don't fail the request, handler can be registered later
  }

  // 6. Return success response
  return successResponse({
    success: true,
    organization: org,
  });
});
