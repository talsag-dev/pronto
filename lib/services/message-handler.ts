/**
 * Message Handler Service
 *
 * Handles incoming WhatsApp messages from Baileys worker.
 * Manages lead creation, message deduplication, AI status, and response generation.
 */

import { supabaseAdmin } from '@/lib/supabase';
import {
  OrganizationsRepository,
  LeadsRepository,
  MessagesRepository,
} from '@/lib/infrastructure/repositories';
import { processMessageWithAI } from '@/lib/services/ai-processor';
import { sendMessage } from '@/lib/integrations/baileys';
import { logger } from '@/lib/shared/utils';


export async function handleIncomingMessage(
  orgId: string,
  from: string,
  messageText: string,
  isFromMe: boolean = false,
  name: string = '',
  whatsappMessageId?: string,
  senderPn?: string
) {
  try {
    logger.info('Processing incoming message', {
      orgId,
      from,
      isFromMe,
      hasName: !!name,
      hasWhatsappId: !!whatsappMessageId,
    });

    // 1. Initialize repositories
    const orgsRepo = new OrganizationsRepository(supabaseAdmin);
    const leadsRepo = new LeadsRepository(supabaseAdmin);
    const messagesRepo = new MessagesRepository(supabaseAdmin);

    // 2. Get organization
    const org = await orgsRepo.getById(orgId);

    if (!org) {
      logger.warn('Organization not found', { orgId });
      return;
    }

    // 3. Clean phone numbers (remove WhatsApp suffixes)
    const phoneNumber = from.split('@')[0];
    const realPhone = senderPn ? senderPn.split('@')[0] : null;

    logger.debug('Phone numbers parsed', {
      from,
      phoneNumber,
      realPhone,
    });

    // 4. Find or Create Lead
    let lead = await leadsRepo.findByPhone(org.id, phoneNumber);

    if (!lead) {
      // Create new lead - if message is from business owner, pause AI
      lead = await leadsRepo.createLead({
        organizationId: org.id,
        phone: phoneNumber,
        name: name || undefined,
      });

      // If business owner starts the chat, pause AI (they want to handle it manually)
      if (isFromMe) {
        lead = await leadsRepo.updateLead(lead.id, { aiStatus: 'paused' });
      }

      logger.info('New lead created from message', {
        leadId: lead.id,
        phone: phoneNumber,
        aiStatus: lead.ai_status,
        isFromMe,
      });
    } else {
      // Existing lead - handle updates
      const updates: any = {};

      // If message is from business owner, pause AI (human takeover)
      if (isFromMe && lead.ai_status !== 'paused') {
        updates.aiStatus = 'paused';
        logger.info('Human reply detected - pausing AI', {
          leadId: lead.id,
          phone: phoneNumber,
        });
      }

      // Update name if provided and different
      if (name && lead.name !== name) {
        updates.name = name;
        logger.debug('Updating lead name', { leadId: lead.id, name });
      }

      // Apply updates if any
      if (Object.keys(updates).length > 0) {
        lead = await leadsRepo.updateLead(lead.id, updates);
      }

      // Update real_phone if available (LID to phone number mapping)
      if (realPhone && lead.real_phone !== realPhone) {
        logger.info('Mapping LID to real phone', {
          leadId: lead.id,
          lid: phoneNumber,
          realPhone,
        });
        // Note: real_phone not in UpdateLeadParams - would need direct update
        await supabaseAdmin
          .from('leads')
          .update({ real_phone: realPhone })
          .eq('id', lead.id);
        lead.real_phone = realPhone;
      }
    }
    // 5. Deduplication: Check if message already exists
    if (whatsappMessageId) {
      const existingMessage = await messagesRepo.findByWhatsAppId(
        whatsappMessageId
      );

      if (existingMessage) {
        logger.debug('Duplicate message skipped', {
          whatsappMessageId,
          leadId: lead.id,
        });
        return;
      }
    }

    // 6. Save incoming message
    await messagesRepo.createMessage({
      organizationId: org.id,
      leadId: lead.id,
      role: isFromMe ? 'assistant' : 'user', // isFromMe = business owner (assistant), else lead (user)
      content: messageText,
      type: 'text',
      whatsappMessageId: whatsappMessageId,
    });

    logger.debug('Message saved', {
      leadId: lead.id,
      role: isFromMe ? 'assistant' : 'user',
      length: messageText.length,
    });

    // 7. Early exit conditions: Don't generate AI response if...

    // If message is from business owner, stop here (we don't reply to ourselves)
    if (isFromMe) {
      logger.debug('Message from business owner - no AI response', {
        leadId: lead.id,
      });
      return;
    }

    // If AI is paused for this lead, stop here (human is handling it)
    if (lead.ai_status === 'paused') {
      logger.info('AI paused for lead - no AI response', {
        leadId: lead.id,
        phone: phoneNumber,
      });
      return;
    }

    // 8. Get conversation history for AI context
    const messages = await messagesRepo.getConversationHistory(lead.id, {
      limit: 20,
      includeSystem: false,
    });

    const conversationHistory = messages
      .filter((m) => m.content !== null)
      .map((m) => ({
        role: m.role,
        content: m.content as string,
      }));

    logger.debug('Conversation history loaded', {
      leadId: lead.id,
      messageCount: conversationHistory.length,
    });

    // 9. Process message with AI
    const orgConfig = org.config as Record<string, any> | null;
    const orgIntegrations = org.integrations as Record<string, any> | null;

    const aiResult = await processMessageWithAI({
      organizationId: org.id,
      organizationName: org.name,
      systemPrompt: orgConfig?.system_prompt,
      calAccessToken: org.cal_access_token || orgIntegrations?.cal_api_key,
      conversationHistory,
      userMessage: messageText,
    });

    // 10. Save and send AI response
    if (aiResult.response) {
      // Save AI response to database
      await messagesRepo.createMessage({
        organizationId: org.id,
        leadId: lead.id,
        role: 'assistant',
        content: aiResult.response,
        whatsappMessageId: `ai-${Date.now()}`, // Temporary ID to prevent double-save from webhook loop
      });

      // Send response via Baileys
      await sendMessage(org.id, from, aiResult.response);

      logger.info('AI response sent via Baileys', {
        leadId: lead.id,
        phone: phoneNumber,
        responseLength: aiResult.response.length,
        hadToolCalls: !!aiResult.toolCalls,
      });
    } else {
      logger.warn('AI generated empty response', {
        leadId: lead.id,
        phone: phoneNumber,
      });
    }
  } catch (error) {
    logger.error('Message handler error', {
      error,
      orgId,
      from,
    });
  }
}
