import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requestPairingCode, getSessionStatus, setupMessageHandler } from '@/lib/integrations/baileys';
import { handleIncomingMessage } from '@/lib/services/message-handler';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action'); // 'status' | 'code'
  
  // 1. Authenticate
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

  // 2. Get User's Organization
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('*')
    .eq('owner_id', user.id)
    .single();

  if (!org) return NextResponse.json({ error: 'No Org' }, { status: 404 });

  const orgId = org.id;

  if (action === 'code') {
    const phoneNumber = searchParams.get('phone');
    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
    }

    try {
      // Ensure message handler is set up
      await setupMessageHandler(orgId, async (from, message, isFromMe) => {
        await handleIncomingMessage(orgId, from, message, isFromMe);
      });

      const code = await requestPairingCode(orgId, phoneNumber);
      return NextResponse.json({ code });
    } catch (error: any) {
      console.error('[BAILEYS PAIRING ERROR]:', error);
      return NextResponse.json({ error: error.message || 'Failed to get pairing code' }, { status: 500 });
    }
  }

  // Default: Status
  const sessionStatus = getSessionStatus(orgId);
  return NextResponse.json({
    ...sessionStatus,
    whatsapp_status: org.whatsapp_status // Include persistent DB status
  });
}
