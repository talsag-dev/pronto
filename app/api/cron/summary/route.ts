import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { triggerIntegration } from '@/lib/integrations/webhook';

function verifyCron(request: Request) {
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(request: Request) {
  if (!verifyCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const results = [];

  // 1. Fetch All Orgs
  const { data: orgs } = await supabaseAdmin.from('organizations').select('*');

  if (!orgs) return NextResponse.json({ message: 'No organizations found' });

  for (const org of orgs) {
      // 2. Fetch Data for this Org
      const { count: newLeadsCount } = await supabaseAdmin
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', org.id)
        .gte('created_at', today.toISOString());

      const summary = `🚀 *Daily Update for ${org.name}*
📅 Date: ${today.toLocaleDateString()}

- New Leads: ${newLeadsCount}
- Meetings Booked: (Check Dashboard)

Good job!`;

      console.log(`[SUMMARY] Sending for ${org.name} (${org.business_phone})`);

      // 3. Send to Owner (Simulated WhatsApp via Waha using business phone, or integrations)
      // Hypothetically send to the 'owner' phone stored in integrations
      // await triggerIntegration('send_summary', { to: org.business_phone, message: summary });
      results.push({ org: org.name, summary });
  }

  return NextResponse.json({ success: true, results });
}
