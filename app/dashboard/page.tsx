import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import DashboardClient from '@/components/DashboardClient';


export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
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
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }
  
  // 2. Fetch User's Organization
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('*')
    .single(); // Just grab the first one for now

  if (!org) {
    return (
      <div className="p-10 text-center">
        <h1 className="text-2xl font-bold">No Organization Found</h1>
        <p>Please create an Organization in Supabase first.</p>
      </div>
    );
  }

  // 3. Fetch Leads Scoped to Org
  const { data: leads } = await supabaseAdmin
    .from('leads')
    .select('*')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false });

  // 4. Get WhatsApp Status (Persisted)
  const status = org.whatsapp_status || 'disconnected';

  return (
    <div className="h-screen w-full bg-slate-50/50 flex flex-col overflow-hidden">
        {/* Pass Org Name to Client */}
        <div className="bg-background border-b border-border p-4 shrink-0 z-10">
            <span className="font-bold text-muted-foreground text-sm">Organization:</span>
            <span className="font-bold ml-2 text-foreground">{org.name}</span>
        </div>
        <div className="flex-1 overflow-hidden">
            <DashboardClient leads={leads || []} user={user} whatsappStatus={status} />
        </div>
    </div>
  );
}
