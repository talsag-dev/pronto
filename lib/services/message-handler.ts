import { supabaseAdmin } from '@/lib/supabase';
import { openai } from '@/lib/ai/config';
import { checkAvailability } from '@/lib/integrations/cal';
import { sendMessage } from '@/lib/integrations/baileys';
import { SYSTEM_PROMPTS } from '@/lib/ai/agents';
//   // Moved to worker to prevent loops
//   console.log('[BAILEYS] Initialization moved to worker.');
// }


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
    // Get organization
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .single();

    if (!org) return;

    // Clean phone number (remove @s.whatsapp.net or @lid)
    const phoneNumber = from.split('@')[0];
    const realPhone = senderPn ? senderPn.split('@')[0] : null;

    // Find or Create Lead
    let { data: lead } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('organization_id', org.id)
      .eq('phone', phoneNumber)
      .single();

    if (!lead) {
      // If message is from ME, and no lead exists, maybe we should create one? 
      // Or maybe not? For now, let's create it to track the conversation.
      const { data: newLead } = await supabaseAdmin
        .from('leads')
        .insert({
          organization_id: org.id,
          phone: phoneNumber,
          status: 'new',
          ai_status: isFromMe ? 'paused' : 'active', // If we started it, maybe keep it active? Or paused?
          name: name || undefined // Save name if available
          // If business OWNER starts chat, they probably want to handle it.
        })
        .select()
        .single();
      lead = newLead;
    } else {
        // If From Me, PAUSE AI
        if (isFromMe && lead.ai_status !== 'paused') {
            console.log(`[BAILEYS] Human reply detected for lead ${lead.id}. Pausing AI.`);
            await supabaseAdmin.from('leads').update({ ai_status: 'paused' }).eq('id', lead.id);
            lead.ai_status = 'paused'; // Update local object
        }

        if (name && lead.name !== name) {
            await supabaseAdmin.from('leads').update({ name }).eq('id', lead.id);
            lead.name = name;
        }

        // Update real_phone if available and missing/different
        if (realPhone && lead.real_phone !== realPhone) {
            console.log(`[BAILEYS] Mapping LID ${phoneNumber} to phone ${realPhone}`);
            await supabaseAdmin.from('leads').update({ real_phone: realPhone }).eq('id', lead.id);
            lead.real_phone = realPhone;
        }
    }
    // 3. Deduplication: Check if this message already exists
    if (whatsappMessageId) {
      const { data: existing } = await supabaseAdmin
        .from('messages')
        .select('id')
        .eq('whatsapp_message_id', whatsappMessageId)
        .single();
        
      if (existing) {
        console.log(`[BAILEYS] Duplicate message skipped: ${whatsappMessageId}`);
        return;
      }
    }

    // 4. Save message
    await supabaseAdmin.from('messages').insert({
      organization_id: org.id,
      lead_id: lead.id,
      role: isFromMe ? 'assistant' : 'user', // isFromMe = assistant (business), else user
      content: messageText,
      type: 'text',
      whatsapp_message_id: whatsappMessageId
    });

    // If message is from ME, stop here (we don't want AI to reply to me/business owner)
    if (isFromMe) {
        return;
    }

    // CHECK AI STATUS: If paused, stop here.
    if (lead.ai_status === 'paused') {
      console.log(`[BAILEYS] AI is paused for lead ${lead.id} (${phoneNumber}). Skipping AI response.`);
      return;
    }

    // Get conversation history
    const { data: history } = await supabaseAdmin
      .from('messages')
      .select('role, content')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: true })
      .limit(20);

    // AI Processing
    const systemPrompt = org.config?.system_prompt || SYSTEM_PROMPTS.SALES;
    const calAccessToken = org.cal_access_token || org.integrations?.cal_api_key;

    const tools = [
      {
        type: 'function',
        function: {
          name: 'check_availability',
          description: 'Check calendar availability',
          parameters: {
            type: 'object',
            properties: {
              startTime: { type: 'string' },
              endTime: { type: 'string' }
            },
            required: ['startTime', 'endTime']
          }
        }
      }
    ];

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...(history || []).map((m: any) => ({ role: m.role, content: m.content })),
      { role: 'user', content: messageText }
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages as any,
      tools: tools as any,
      tool_choice: 'auto'
    });

    const aiMessage = response.choices[0].message;
    let finalResponse = aiMessage.content;

    // Handle tool calls
    if (aiMessage.tool_calls) {
      for (const toolCall of aiMessage.tool_calls) {
        const tc = toolCall as any;
        if (tc.function?.name === 'check_availability') {
          const args = JSON.parse(tc.function.arguments);
          const result = await checkAvailability(args.startTime, args.endTime, calAccessToken);
          finalResponse = `Based on the calendar: ${JSON.stringify(result)}`;
        }
      }
    }

    // Save AI response
    if (finalResponse) {
      await supabaseAdmin.from('messages').insert({
        organization_id: org.id,
        lead_id: lead.id,
        role: 'assistant',
        content: finalResponse,
        whatsapp_message_id: `ai-${Date.now()}` // Temporary ID to prevent double-save from webhook loop
      });

      // Send via Baileys
      await sendMessage(org.id, from, finalResponse);
      console.log(`[BAILEYS] Sent: ${finalResponse}`);
    }
  } catch (error) {
    console.error('[BAILEYS MESSAGE HANDLER ERROR]:', error);
  }
}
