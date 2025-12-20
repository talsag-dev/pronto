import { createClient } from '@supabase/supabase-js';
import { sendMessage } from '@/lib/integrations/baileys';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Auth Check (Simplistic for now, relies on client sending valid session or just open for demo)
    // ideally check session here
    
    const { leadId, message, orgId } = await request.json();

    if (!leadId || !message || !orgId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 2. Get Lead to get phone number
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('phone')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // 3. Send Message via Baileys
    await sendMessage(orgId, lead.phone, message);

    // 4. Save to Database
    const { error: dbError } = await supabase.from('messages').insert({
      organization_id: orgId,
      lead_id: leadId,
      role: 'assistant',
      content: message,
      type: 'text',
      // metadata: { source: 'manual' } // Optional: track this was manual
    });

    if (dbError) {
        console.error('Failed to save manual message:', dbError);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error sending manual message:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
