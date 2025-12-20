import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { setupMessageHandler } from '@/lib/integrations/baileys';
import { handleIncomingMessage, initializeWhatsAppListeners } from '@/lib/services/message-handler';

// Initialize handlers on first request (backup)
export async function GET(request: Request) {
  await initializeWhatsAppListeners();
  return NextResponse.json({ status: 'handlers_initialized' });
}

export async function POST(request: Request) {
  await initializeWhatsAppListeners();
  
  // Manual webhook trigger for testing
  const body = await request.json();
  const { orgId, from, message } = body;
  
  if (orgId && from && message) {
    await handleIncomingMessage(orgId, from, message);
    return NextResponse.json({ status: 'processed' });
  }
  
  return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
}
