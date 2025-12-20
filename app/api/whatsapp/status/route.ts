import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    // TODO: In production, get user from auth
    // const { data: { user } } = await supabase.auth.getUser()
    // For MVP: Get first org
    
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('id, whatsapp_phone_number, whatsapp_phone_id')
      .single();

    if (!org) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: !!org.whatsapp_phone_id,
      phoneNumber: org.whatsapp_phone_number,
      orgId: org.id
    });

  } catch (error) {
    return NextResponse.json({ connected: false, error: 'Failed to fetch status' });
  }
}
