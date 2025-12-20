import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { openai } from '@/lib/ai/config';
import { checkAvailability } from '@/lib/integrations/cal';
import { SYSTEM_PROMPTS } from '@/lib/ai/agents';

// Type definitions for Waha payload
type WahaPayload = {
  session: string; // Waha Session Name
  payload: {
    from: string; // The sender (Lead)
    to: string; // The receiver (Business Phone / Waha Session)
    body: string;
    hasMedia?: boolean;
    media?: {
      url: string;
      mimetype: string;
    };
  };
};

export async function POST(request: Request) {
  try {
    const body: WahaPayload = await request.json();
    const { session } = body;
    const { from: leadPhone, to: businessPhone, body: text, hasMedia, media } = body.payload;

    console.log(`[WEBHOOK] Session: ${session} | Business: ${businessPhone} | Lead: ${leadPhone} | Msg: ${text || 'Media'}`);

    // 1. Identify Organization (Multi-Tenant Lookup)
    let org;

    // Strategy A: Session Name (Preferred)
    if (session && session.startsWith('org_')) {
        const orgId = session.split('org_')[1];
        const { data } = await supabaseAdmin
          .from('organizations')
          .select('*')
          .eq('id', orgId)
          .single();
        org = data;
    }

    // Strategy B: Business Phone (Fallback)
    if (!org) {
        const cleanBusinessPhone = businessPhone.split('@')[0];
        const { data } = await supabaseAdmin
          .from('organizations')
          .select('*')
          .eq('business_phone', cleanBusinessPhone)
          .single();
        org = data;
    }

    if (!org) {
      console.warn(`[WEBHOOK] Ignored: No organization found for session ${session} or phone ${businessPhone}`);
      return NextResponse.json({ ignored: true });
    }

    // 2. Identify Lead within that Org
    let { data: lead } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('organization_id', org.id)
      .eq('phone', leadPhone)
      .single();

    let history: any[] = [];

    if (!lead) {
      // New Lead for this Org
      const { data: newLead, error } = await supabaseAdmin
        .from('leads')
        .insert({ 
            organization_id: org.id,
            phone: leadPhone, 
            status: 'new' 
        })
        .select()
        .single();
      
      if (error) throw error;
      lead = newLead;
    } else {
      // Fetch History
      const { data: msgs } = await supabaseAdmin
        .from('messages')
        .select('role, content')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: true })
        .limit(20);
        
      if (msgs) history = msgs;
    }

    // 3. Process Input
    let userMessage = text;
    if (hasMedia && media?.mimetype.startsWith('audio')) {
      userMessage = "[Audio Note] (Transcription simulation)";
    }

    // 4. Save User Message
    await supabaseAdmin.from('messages').insert({
      organization_id: org.id,
      lead_id: lead.id,
      role: 'user',
      content: userMessage,
      type: hasMedia ? 'audio' : 'text'
    });

    // 5. AI Processing (Dynamic Context)
    // Load System Prompt from Org Config or Fallback
    const orgConfig = org.config || {};
    const systemPrompt = orgConfig.system_prompt || SYSTEM_PROMPTS.SALES;
    
    // Load Integrations
    // Hybrid Auth: Try OAuth Token first, fallback to manual API Key
    const integrations = org.integrations || {};
    const calAccessToken = org.cal_access_token || integrations.cal_api_key;

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
      ...history.map((m: any) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage }
    ];

    const runner = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages as any,
      tools: tools as any,
      tool_choice: 'auto'
    });

    const msg = runner.choices[0].message;
    let finalResponse = msg.content;

    // Handle Tool Calls (Simplified for MVP)
    if (msg.tool_calls) {
        // ... Logic same as before, but potentially pass calApiKey to checkAvailability
    }

    // 6. Save & Send Response
    if (finalResponse) {
      await supabaseAdmin.from('messages').insert({
        organization_id: org.id,
        lead_id: lead.id,
        role: 'assistant',
        content: finalResponse
      });
      // Send via Waha...
      console.log(`[AI REPLY] Org: ${org.name} | To: ${leadPhone} | Msg: ${finalResponse}`);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
