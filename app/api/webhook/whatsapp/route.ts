import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { openai } from '@/lib/ai/config';
import { checkAvailability } from '@/lib/integrations/cal';
import { sendWhatsAppMessage } from '@/lib/integrations/whatsapp-cloud';
import { SYSTEM_PROMPTS } from '@/lib/ai/agents';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // Verify webhook
  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    console.log('[WEBHOOK] Verified');
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Meta sends test messages, ignore them
    if (body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ status: 'ignored' });
    }

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages) {
      return NextResponse.json({ status: 'no_messages' });
    }

    const message = value.messages[0];
    const phoneNumberId = value.metadata.phone_number_id;
    const from = message.from; // Lead's phone
    const messageText = message.text?.body;

    console.log(`[WHATSAPP] Phone ID: ${phoneNumberId} | From: ${from} | Message: ${messageText}`);

    // 1. Find Organization by phone_number_id
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('whatsapp_phone_id', phoneNumberId)
      .single();

    if (!org) {
      console.warn(`[WHATSAPP] No org found for phone_id: ${phoneNumberId}`);
      return NextResponse.json({ status: 'no_org' });
    }

    // 2. Find or Create Lead
    let { data: lead } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('organization_id', org.id)
      .eq('phone', from)
      .single();

    if (!lead) {
      const { data: newLead } = await supabaseAdmin
        .from('leads')
        .insert({
          organization_id: org.id,
          phone: from,
          status: 'new'
        })
        .select()
        .single();
      lead = newLead;
    }

    // 3. Save incoming message
    await supabaseAdmin.from('messages').insert({
      organization_id: org.id,
      lead_id: lead.id,
      role: 'user',
      content: messageText,
      type: 'text'
    });

    // 4. Get conversation history
    const { data: history } = await supabaseAdmin
      .from('messages')
      .select('role, content')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: true })
      .limit(20);

    // 5. AI Processing
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
        const tc = toolCall as any; // Type assertion for OpenAI SDK compatibility
        if (tc.function?.name === 'check_availability') {
          const args = JSON.parse(tc.function.arguments);
          const result = await checkAvailability(args.startTime, args.endTime, calAccessToken);
          finalResponse = `Based on the calendar: ${JSON.stringify(result)}`;
        }
      }
    }

    // 6. Save AI response
    if (finalResponse) {
      await supabaseAdmin.from('messages').insert({
        organization_id: org.id,
        lead_id: lead.id,
        role: 'assistant',
        content: finalResponse
      });

      // 7. Send via WhatsApp Cloud API
      await sendWhatsAppMessage(
        org.whatsapp_phone_id!,
        org.whatsapp_access_token!,
        from,
        finalResponse
      );

      console.log(`[AI] Sent: ${finalResponse}`);
    }

    return NextResponse.json({ status: 'success' });

  } catch (error) {
    console.error('[WHATSAPP WEBHOOK ERROR]:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
