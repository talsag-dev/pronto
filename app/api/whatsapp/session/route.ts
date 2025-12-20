import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession, startSession, stopSession, getQR, getScreenshot } from '@/lib/integrations/waha';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action'); // 'status' | 'qr' | 'screenshot'
  
  // 1. Authenticate (MVP: Hardcoded Org 1)
  const { data: org } = await supabaseAdmin.from('organizations').select('*').single();
  if (!org) return NextResponse.json({ error: 'No Org' }, { status: 404 });

  // WAHA FREE TIER LIMITATION: Only supports 'default' session.
  // For MVP, we map the first Org to the 'default' session.
  const sessionName = 'default';

  if (action === 'qr') {
      const buffer = await getQR(sessionName);
      if (!buffer) return new NextResponse(null, { status: 404 });
      return new NextResponse(buffer, { headers: { 'Content-Type': 'image/png' } });
  }

  if (action === 'screenshot') {
      const buffer = await getScreenshot(sessionName);
      if (!buffer) return new NextResponse(null, { status: 404 });
      return new NextResponse(buffer, { headers: { 'Content-Type': 'image/png' } });
  }

  // Default: Status
  const session = await getSession(sessionName);
  return NextResponse.json({ 
      sessionName, 
      status: session?.status || 'STOPPED',
      config: session?.config 
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { action } = body; // 'start' | 'stop'

  // 1. Authenticate
  const { data: org } = await supabaseAdmin.from('organizations').select('*').single();
  if (!org) return NextResponse.json({ error: 'No Org' }, { status: 404 });

  const sessionName = 'default';

  try {
      if (action === 'start') {
          await startSession(sessionName);
          return NextResponse.json({ success: true, status: 'STARTING' });
      }
      if (action === 'stop') {
          await stopSession(sessionName);
          return NextResponse.json({ success: true, status: 'STOPPED' });
      }
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
