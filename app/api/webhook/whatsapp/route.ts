/**
 * WhatsApp Cloud API Webhook
 * GET/POST /api/webhook/whatsapp
 *
 * Handles webhooks from Meta's WhatsApp Cloud API.
 * GET: Webhook verification during setup
 * POST: Receives incoming WhatsApp messages
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { successResponse, withErrorHandler, commonErrors } from '@/lib/api';
import { supabaseAdmin } from '@/lib/supabase';
import {
  OrganizationsRepository,
  LeadsRepository,
  MessagesRepository,
} from '@/lib/infrastructure/repositories';
import { processMessageWithAI } from '@/lib/services/ai-processor';
import { sendWhatsAppMessage } from '@/lib/integrations/whatsapp-cloud';
import { logger } from '@/lib/shared/utils';

/**
 * GET - Webhook Verification
 * Meta calls this endpoint during webhook setup to verify ownership
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  logger.debug('WhatsApp webhook verification request', { mode, hasToken: !!token });

  // Verify webhook with Meta's verify token
  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    logger.info('WhatsApp webhook verified successfully');
    return new NextResponse(challenge, { status: 200 });
  }

  logger.warn('WhatsApp webhook verification failed', { mode, tokenMatch: false });
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

export const maxDuration = 60; // Allow 60s timeout for long-running AI processing

/**
 * POST - Receive WhatsApp Messages
 * Meta calls this endpoint when a message is received
 */
export const POST = withErrorHandler(async (request: Request) => {
  // 1. Parse request body (Meta doesn't follow standard validation)
  const body = await request.json();

  // Meta sends test messages during setup - ignore them
  if (body.object !== 'whatsapp_business_account') {
    logger.debug('WhatsApp webhook ignored - not business account', {
      object: body.object,
    });
    return successResponse({ status: 'ignored' });
  }

  // Extract message details from Meta's webhook structure
  const entry = body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  if (!value?.messages) {
    logger.debug('WhatsApp webhook ignored - no messages');
    return successResponse({ status: 'no_messages' });
  }

  const message = value.messages[0];
  const phoneNumberId = value.metadata?.phone_number_id;
  const from = message.from; // Lead's phone number
  const messageText = message.text?.body;

  if (!phoneNumberId || !from) {
    logger.warn('WhatsApp webhook missing required fields', {
      hasPhoneNumberId: !!phoneNumberId,
      hasFrom: !!from,
    });
    return commonErrors.badRequest('Missing phone_number_id or from');
  }

  logger.info('WhatsApp webhook received', {
    phoneNumberId,
    from,
    hasText: !!messageText,
  });

  // 2. Find Organization by WhatsApp phone_number_id
  const orgsRepo = new OrganizationsRepository(supabaseAdmin);

  // Note: Using direct query because whatsapp_phone_id is not in the generated types
  // This field is dynamically added during OAuth callback
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('*')
    .eq('whatsapp_phone_id', phoneNumberId)
    .single();

  if (!org) {
    logger.warn('WhatsApp webhook ignored - no organization found', {
      phoneNumberId,
    });
    return successResponse({ status: 'no_org' });
  }

  // 3. Find or Create Lead
  const leadsRepo = new LeadsRepository(supabaseAdmin);
  const messagesRepo = new MessagesRepository(supabaseAdmin);

  let lead = await leadsRepo.findByPhone(org.id, from);

  if (!lead) {
    // New lead - create it
    lead = await leadsRepo.createLead({
      organizationId: org.id,
      phone: from,
    });
    logger.info('New lead created for WhatsApp message', {
      leadId: lead.id,
      orgId: org.id,
      phone: from,
    });
  }

  // 4. Save incoming message
  await messagesRepo.createMessage({
    organizationId: org.id,
    leadId: lead.id,
    role: 'user',
    content: messageText || '',
    type: 'text',
  });

  // 5. Get conversation history
  const messages = await messagesRepo.getConversationHistory(lead.id, {
    limit: 20,
    includeSystem: false,
  });

  const history = messages
    .filter((m) => m.content !== null)
    .map((m) => ({
      role: m.role,
      content: m.content as string,
    }));

  logger.debug('Fetched WhatsApp conversation history', {
    leadId: lead.id,
    messageCount: history.length,
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
    userMessage: messageText || '',
  });

  // 7. Save & Send AI Response
  if (aiResult.response) {
    // Save assistant message to database
    await messagesRepo.createMessage({
      organizationId: org.id,
      leadId: lead.id,
      role: 'assistant',
      content: aiResult.response,
    });

    // Send via WhatsApp Cloud API
    const whatsappPhoneId = (org as any).whatsapp_phone_id;
    const whatsappAccessToken = (org as any).whatsapp_access_token;

    if (whatsappPhoneId && whatsappAccessToken) {
      await sendWhatsAppMessage(
        whatsappPhoneId,
        whatsappAccessToken,
        from,
        aiResult.response
      );

      logger.info('WhatsApp AI response sent', {
        orgId: org.id,
        orgName: org.name,
        leadPhone: from,
        responseLength: aiResult.response.length,
        hadToolCalls: !!aiResult.toolCalls,
      });
    } else {
      logger.warn('WhatsApp credentials missing - response not sent', {
        orgId: org.id,
        hasPhoneId: !!whatsappPhoneId,
        hasAccessToken: !!whatsappAccessToken,
      });
    }
  }

  return successResponse({ status: 'success' });
});
