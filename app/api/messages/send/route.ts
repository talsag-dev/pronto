import { createClient } from '@supabase/supabase-js';
import { sendMessage } from '@/lib/integrations/baileys';
import { NextResponse } from 'next/server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
             try {
                cookiesToSet.forEach(({ name, value, options }) =>
                   cookieStore.set(name, value, options)
                );
             } catch {}
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { leadId, message, orgId } = await request.json();

    if (!leadId || !message || !orgId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify ownership
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('id', orgId)
      .eq('owner_id', user.id)
      .single();

    if (!org) {
      return NextResponse.json({ error: 'Organization not found or access denied' }, { status: 403 });
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

    // 5. Auto-Pause AI for this lead
    const { error: updateError } = await supabase
      .from('leads')
      .update({ ai_status: 'paused' })
      .eq('id', leadId);
      
    if (updateError) {
        console.error('Failed to auto-pause AI for lead:', updateError);
    }

    if (dbError) {
        console.error('Failed to save manual message:', dbError);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error sending manual message:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
