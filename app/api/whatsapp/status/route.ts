import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
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
      return NextResponse.json({ connected: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('id, whatsapp_phone_number, whatsapp_phone_id')
      .eq('owner_id', user.id)
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
