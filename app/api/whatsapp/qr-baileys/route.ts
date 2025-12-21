import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getQRCode, setupMessageHandler } from '@/lib/integrations/baileys';
import { handleIncomingMessage } from '@/lib/services/message-handler';
import QRCode from 'qrcode';

export async function GET(request: Request) {
  try {
    // Get organization (MVP: first org)
    const { data: org } = await supabaseAdmin.from('organizations').select('*').single();
    if (!org) return NextResponse.json({ error: 'No Org' }, { status: 404 });

    const orgId = org.id;

    // Ensure message handler is set up
    await setupMessageHandler(orgId, async (from, message, isFromMe) => {
      await handleIncomingMessage(orgId, from, message, isFromMe);
    });

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
