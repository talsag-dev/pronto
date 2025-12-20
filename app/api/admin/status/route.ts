import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
// We need to access the internal session states from baileys.ts
// This is a bit of a hack since Next.js isolates API routes, but for the same server instance it might work.
// If not, we rely on the DB status.

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Get all organizations
    const { data: orgs, error } = await supabaseAdmin
      .from('organizations')
      .select('id, name, whatsapp_status, business_phone');

    if (error) throw error;

    // Get WhatsApp session data to find actual connected phone
    const { data: sessions } = await supabaseAdmin
      .from('whatsapp_sessions')
      .select('session_id, key, value');

    // Map session data to organizations
    const orgsWithSessionData = orgs?.map(org => {
      const orgSessions = sessions?.filter(s => s.session_id === org.id) || [];
      
      // Try to find the phone number from session data (stored in creds)
      const credsSession = orgSessions.find(s => s.key === 'creds');
      let connectedPhone = org.business_phone;
      
      if (credsSession?.value) {
        try {
          const creds = JSON.parse(credsSession.value);
          // Baileys stores the phone in creds.me.id
          if (creds?.me?.id) {
            connectedPhone = creds.me.id.split(':')[0]; // Format: "1234567890:XX@s.whatsapp.net"
          }
        } catch (e) {
          // Ignore parse errors
        }
      }

      return {
        ...org,
        connected_phone: connectedPhone,
        has_session_data: orgSessions.length > 0
      };
    });

    return NextResponse.json({
        success: true,
        organizations: orgsWithSessionData
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
