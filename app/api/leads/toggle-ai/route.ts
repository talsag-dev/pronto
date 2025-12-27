/**
 * Toggle AI Status for Lead
 * POST /api/leads/toggle-ai
 *
 * Toggles the AI assistant status (active/paused) for a specific lead.
 */

import {
  requireAuth,
  successResponse,
  withErrorHandler,
  validateRequest,
} from '@/lib/api';
import { toggleAISchema } from '@/lib/api/schemas';
import { LeadsRepository } from '@/lib/infrastructure/repositories';
import { supabaseAdmin } from '@/lib/supabase';

export const POST = withErrorHandler(async (request: Request) => {
  // 1. Authenticate user
  const user = await requireAuth();

  // 2. Validate request body
  const { leadId, status } = await validateRequest(request, toggleAISchema);

  // 3. Initialize repository
  const leadsRepo = new LeadsRepository(supabaseAdmin);

  // 4. Verify lead exists and user has access
  const lead = await leadsRepo.getByIdOrFail(leadId);

  // 5. Verify organization ownership
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('id', lead.organization_id)
    .eq('owner_id', user.id)
    .single();

  if (!org) {
    throw new Error('Forbidden');
  }

  // 6. Toggle AI status
  await leadsRepo.toggleAI(leadId, status);

  // 7. Return success response
  return successResponse({ success: true, leadId, status });
});
