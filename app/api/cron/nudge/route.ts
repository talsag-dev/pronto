import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { openai } from '@/lib/ai/config';
import { SYSTEM_PROMPTS } from '@/lib/ai/agents';

function verifyCron(request: Request) {
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(request: Request) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = [];
  
  // 1. Fetch All Orgs
  const { data: orgs } = await supabaseAdmin.from('organizations').select('*');

  if (!orgs) return NextResponse.json({ message: 'No organizations found' });

  for (const org of orgs) {
      console.log(`[CRON] Processing Nudge for Org: ${org.name}`);
      const systemPrompt = org.config?.system_prompt || SYSTEM_PROMPTS.SALES;

      // 2. Find Stale Leads for this Org
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const { data: staleLeads } = await supabaseAdmin
        .from('leads')
        .select('*')
        .eq('organization_id', org.id)
        .lt('last_message_at', threeDaysAgo.toISOString())
        .neq('status', 'closed')
        .limit(5);

      if (staleLeads) {
          for (const lead of staleLeads) {
               // 3. Generate Org-Specific Nudge
               const completion = await openai.chat.completions.create({
                  model: 'gpt-4o',
                  messages: [
                    { role: 'system', content: `You are an assistant for ${org.name}. ${systemPrompt}. The user hasn't replied in 3 days. Send a gentle, short bump message.` },
                    { role: 'user', content: `Last status: ${lead.status}` }
                  ]
                });

                const nudgeMessage = completion.choices[0].message.content;

                // 4. Save & Send
                await supabaseAdmin.from('messages').insert({
                  organization_id: org.id,
                  lead_id: lead.id,
                  role: 'assistant',
                  content: nudgeMessage
                });
                
                await supabaseAdmin.from('leads').update({
                  last_message_at: new Date().toISOString()
                }).eq('id', lead.id);

                console.log(`[NUDGE] Org: ${org.name} | Lead: ${lead.phone} | Msg: ${nudgeMessage}`);
                results.push({ org: org.name, lead: lead.phone, status: 'nudged' });
          }
      }
  }

  return NextResponse.json({ results });
}
