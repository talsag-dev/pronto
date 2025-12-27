/**
 * Send Message to Lead
 * POST /api/messages/send
 *
 * Sends a message to a lead via WhatsApp and stores it in the database.
 * Automatically pauses AI for the lead after sending a manual message.
 */

import {
  requireOrganizationOwnership,
  successResponse,
  withErrorHandler,
  validateRequest,
} from '@/lib/api';
import { sendMessageSchema } from '@/lib/api/schemas';
import {
  LeadsRepository,
  MessagesRepository,
} from '@/lib/infrastructure/repositories';
import { supabaseAdmin } from '@/lib/supabase';
import { sendMessage } from '@/lib/integrations/baileys';
import { logger } from '@/lib/shared/utils';

export const POST = withErrorHandler(async (request: Request) => {
  // 1. Validate request body
  const { leadId, orgId, message } = await validateRequest(
    request,
    sendMessageSchema
  );

  // 2. Authenticate and verify organization ownership
  const { user } = await requireOrganizationOwnership(orgId);

  // 3. Initialize repositories
  const leadsRepo = new LeadsRepository(supabaseAdmin);
  const messagesRepo = new MessagesRepository(supabaseAdmin);

  // 4. Get lead and verify it belongs to the organization
  const lead = await leadsRepo.getByIdOrFail(leadId);

  if (lead.organization_id !== orgId) {
    throw new Error('Forbidden');
  }

  // 5. Send message via WhatsApp (Baileys)
  logger.info('Sending manual message', {
    leadId,
    orgId,
    phone: lead.phone,
  });

  const response = await sendMessage(orgId, lead.phone, message);
  const whatsappMessageId = response?.result?.key?.id;

  // 6. Save message to database
  const savedMessage = await messagesRepo.createMessage({
    organizationId: orgId,
    leadId,
    role: 'assistant',
    content: message,
    type: 'text',
    whatsappMessageId,
  });

  // 7. Auto-pause AI for this lead
  await leadsRepo.toggleAI(leadId, 'paused');

  logger.info('Manual message sent successfully', {
    leadId,
    messageId: savedMessage.id,
    aiPaused: true,
  });

  // 8. Return success response
  return successResponse({
    success: true,
    messageId: savedMessage.id,
    whatsappMessageId,
  });
});
