/**
 * WAHA Webhook
 * POST /api/webhook
 *
 * Receives WhatsApp messages from WAHA (WhatsApp HTTP API) service.
 * Handles multi-tenant organization lookup, lead management, and AI processing.
 */

import { z } from 'zod';
import { successResponse, withErrorHandler } from '@/lib/api';
import { supabaseAdmin } from '@/lib/supabase';
import {
  OrganizationsRepository,
  LeadsRepository,
  MessagesRepository,
} from '@/lib/infrastructure/repositories';
import { processMessageWithAI } from '@/lib/services/ai-processor';
import { logger } from '@/lib/shared/utils';

// Zod schema for WAHA webhook payload
const wahaWebhookSchema = z.object({
  session: z.string().min(1, 'Session is required'),
  payload: z.object({
    from: z.string().min(1, 'Sender phone is required'),
    to: z.string().min(1, 'Receiver phone is required'),
    body: z.string(),
    hasMedia: z.boolean().optional(),
    media: z
      .object({
        url: z.string().url(),
        mimetype: z.string(),
      })
      .optional(),
  }),
});

export const maxDuration = 60; // Allow 60s timeout for long-running AI processing

export const POST = withErrorHandler(async (request: Request) => {
  // 1. Parse and validate request body
  const body = await request.json();
  const validation = wahaWebhookSchema.safeParse(body);

  if (!validation.success) {
    logger.warn('WAHA webhook validation failed', {
      errors: validation.error.issues,
    });
    return successResponse({ ignored: true, reason: 'Invalid payload' });
  }

  const { session, payload } = validation.data;
  const { from: leadPhone, to: businessPhone, body: text, hasMedia, media } = payload;

  logger.info('WAHA webhook received', {
    session,
    businessPhone,
    leadPhone,
    hasText: !!text,
    hasMedia: !!hasMedia,
  });

  // 2. Identify Organization (Multi-Tenant Lookup)
  const orgsRepo = new OrganizationsRepository(supabaseAdmin);
  let org = null;

  // Strategy A: Session Name (Preferred - format: "org_<orgId>")
  if (session.startsWith('org_')) {
    const orgId = session.split('org_')[1];
    org = await orgsRepo.getById(orgId);
    logger.debug('Organization lookup by session', { orgId, found: !!org });
  }

  // Strategy B: Business Phone (Fallback)
  if (!org) {
    const cleanBusinessPhone = businessPhone.split('@')[0];
    org = await orgsRepo.getByBusinessPhone(cleanBusinessPhone);
    logger.debug('Organization lookup by phone', {
      businessPhone: cleanBusinessPhone,
      found: !!org,
    });
  }

  if (!org) {
    logger.warn('WAHA webhook ignored - no organization found', {
      session,
      businessPhone,
    });
    return successResponse({ ignored: true, reason: 'No organization found' });
  }

  // 3. Find or Create Lead
  const leadsRepo = new LeadsRepository(supabaseAdmin);
  const messagesRepo = new MessagesRepository(supabaseAdmin);

  let lead = await leadsRepo.findByPhone(org.id, leadPhone);
  let history: Array<{ role: string; content: string }> = [];

  if (!lead) {
    // New lead - create it
    lead = await leadsRepo.createLead({
      organizationId: org.id,
      phone: leadPhone,
    });
    logger.info('New lead created for WAHA message', {
      leadId: lead.id,
      orgId: org.id,
      phone: leadPhone,
    });
  } else {
    // Existing lead - fetch conversation history
    const messages = await messagesRepo.getConversationHistory(lead.id, {
      limit: 20,
      includeSystem: false,
    });
    history = messages
      .filter((m) => m.content !== null)
      .map((m) => ({
        role: m.role,
        content: m.content as string,
      }));
    logger.debug('Fetched conversation history', {
      leadId: lead.id,
      messageCount: history.length,
    });
  }

  // 4. Process Input Message
  let userMessage = text || '';
  if (hasMedia && media?.mimetype.startsWith('audio')) {
    userMessage = '[Audio Note] (Transcription simulation)';
    logger.debug('Audio message detected', { mimetype: media.mimetype });
  }

  // 5. Save User Message
  await messagesRepo.createMessage({
    organizationId: org.id,
    leadId: lead.id,
    role: 'user',
    content: userMessage,
    type: hasMedia ? 'audio' : 'text',
  });

  // 6. Process message with AI
  const orgConfig = org.config as Record<string, any> | null;
  const orgIntegrations = org.integrations as Record<string, any> | null;

  const aiResult = await processMessageWithAI({
    organizationId: org.id,
    organizationName: org.name,
    systemPrompt: orgConfig?.system_prompt,
    calAccessToken: org.cal_access_token || orgIntegrations?.cal_api_key,
    conversationHistory: history,
    userMessage,
  });

  // 7. Save & Send AI Response
  if (aiResult.response) {
    await messagesRepo.createMessage({
      organizationId: org.id,
      leadId: lead.id,
      role: 'assistant',
      content: aiResult.response,
    });

    logger.info('WAHA AI response generated', {
      orgId: org.id,
      orgName: org.name,
      leadPhone,
      responseLength: aiResult.response.length,
      hadToolCalls: !!aiResult.toolCalls,
    });

    // TODO: Send response via WAHA API
    // await sendWahaMessage(session, leadPhone, aiResult.response);
  }

  return successResponse({ success: true });
});
