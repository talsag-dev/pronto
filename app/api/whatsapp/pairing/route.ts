import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requestPairingCode, getSessionStatus } from '@/lib/integrations/baileys';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action'); // 'status' | 'code'
  
  // 1. Authenticate (MVP: Hardcoded Org 1)
  const { data: org } = await supabaseAdmin.from('organizations').select('*').single();
  if (!org) return NextResponse.json({ error: 'No Org' }, { status: 404 });

  const orgId = org.id;

  if (action === 'code') {
    const phoneNumber = searchParams.get('phone');
    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
    }

    try {
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
