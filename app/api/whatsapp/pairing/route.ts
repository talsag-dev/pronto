import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { requestPairingCode, getSessionStatus } from '@/lib/integrations/baileys';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { phoneNumber } = await request.json();
    
    // Auth
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
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('owner_id', user.id)
      .single();

    if (!org) return NextResponse.json({ error: 'No Org' }, { status: 404 });

    const code = await requestPairingCode(org.id, phoneNumber);
    return NextResponse.json({ code });

  } catch (error: any) {
    console.error('[PAIRING ERROR]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


