import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { businessName } = await request.json();

    if (!businessName) {
      return NextResponse.json({ success: false, error: 'Business name is required' }, { status: 400 });
    }

    // Get authenticated user
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
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
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    // Create organization
    const { data: org, error } = await supabaseAdmin
      .from('organizations')
      .insert({
        owner_id: user.id,
        name: businessName,
        business_phone: `placeholder_${crypto.randomUUID()}`, // Placeholder until WhatsApp connected
        config: {
          system_prompt: "You are a helpful AI assistant for my business.",
          operating_hours: "09:00-18:00"
        },
        integrations: {}
      })
      .select()
      .single();

    if (error) {
      console.error('[ONBOARDING] Failed to create organization:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log(`[ONBOARDING] Created organization ${org.id} for user ${user.id}`);

    // Register message handler for the new organization
    try {
      const { ensureWorkerSession } = await import('@/lib/integrations/baileys');
      // const { handleIncomingMessage } = await import('@/lib/services/message-handler');
      
      await ensureWorkerSession(org.id);
      
      console.log(`[ONBOARDING] Registered message handler for ${org.id}`);
    } catch (handlerError) {
      console.error('[ONBOARDING] Failed to register message handler:', handlerError);
      // Don't fail the request, handler can be registered later
    }

    return NextResponse.json({ success: true, organization: org });
  } catch (error: any) {
    console.error('[ONBOARDING] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
