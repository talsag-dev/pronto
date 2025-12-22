import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getQRCode, ensureWorkerSession } from '@/lib/integrations/baileys';
import { handleIncomingMessage } from '@/lib/services/message-handler';
import QRCode from 'qrcode';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
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

    // Ensure session is initialized on worker
    await ensureWorkerSession(orgId);

    // Get QR code from Baileys
    const qrData = await getQRCode(orgId);
    
    if (!qrData) {
      return NextResponse.json({ error: 'No QR code available' }, { status: 404 });
    }

    // Convert to base64 image
    const qrImage = await QRCode.toDataURL(qrData);
    
    return NextResponse.json({ qr: qrImage });
  } catch (error: any) {
    console.error('[QR ERROR]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
