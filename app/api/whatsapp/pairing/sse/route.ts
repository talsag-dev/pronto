import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
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
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  if (!org) return new Response('No Organization', { status: 404 });

  const WORKER_URL = process.env.WHATSAPP_WORKER_URL || 'http://localhost:4000';
  const WORKER_SECRET = process.env.WORKER_SECRET || 'dev-secret';

  const response = await fetch(`${WORKER_URL}/session/${org.id}/sse?secret=${WORKER_SECRET}`);

  if (!response.ok) {
    return new Response('Worker error', { status: 500 });
  }

  // Stream from worker to client
  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body?.getReader();
      if (!reader) {
        controller.close();
        return;
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
      } catch (err) {
        console.error('[SSE PROXY ERROR]:', err);
      } finally {
        reader.releaseLock();
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
