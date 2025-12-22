import { NextResponse } from 'next/server';
import { logoutSession } from '@/lib/integrations/baileys';
import { supabaseAdmin } from '@/lib/supabase';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function DELETE(request: Request) {
  try {
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
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get User's Organization
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('owner_id', user.id)
      .single();

    if (!org) {
        return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 });
    }

    const orgId = org.id;

    // Terminate the session (closes socket, clears memory, deletes DB data)
    await logoutSession(orgId);

    console.log(`[API] Session terminated for ${orgId}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Session terminated successfully.' 
    });
  } catch (error: any) {
    console.error('[API] Error resetting session:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
