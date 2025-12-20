import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
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
      return NextResponse.json({ authorized: false });
    }

    // Check if user email matches admin email from env
    const adminEmail = process.env.ADMIN_EMAIL || 'talsagie19@gmail.com';
    const authorized = user.email === adminEmail;

    console.log(`[ADMIN AUTH] User ${user.email} - Authorized: ${authorized}`);

    return NextResponse.json({ authorized });
  } catch (error) {
    console.error('[ADMIN AUTH] Error:', error);
    return NextResponse.json({ authorized: false });
  }
}
