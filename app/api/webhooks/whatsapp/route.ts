import { NextResponse } from 'next/server';
import { handleIncomingMessage } from '@/lib/services/message-handler';
import { isJidBroadcast } from '@whiskeysockets/baileys';

export const maxDuration = 60; // Allow 60s timeout

export async function POST(req: Request) {
  try {
    const secret = req.headers.get('x-worker-secret');
    const WORKER_SECRET = process.env.WORKER_SECRET || 'dev-secret';

    if (secret !== WORKER_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orgId, message, type } = await req.json();
    const whatsappMessageId = message?.key?.id;

    if (!orgId || !message) {
      return NextResponse.json({ error: 'Missing orgId or message' }, { status: 400 });
    }

    const msg = message;
    const from = msg.key.remoteJid!;
    const isFromMe = msg.key.fromMe || false;

    // Extract text logic (similar to original logic)
    const messageText = msg.message?.conversation || 
                       msg.message?.extendedTextMessage?.text || 
                       '';

    if (messageText) {
      const pushName = msg.pushName || ''; // Extract pushName
      console.log(`[WEBHOOK] Processing msg from=${from} name=${pushName} isFromMe=${isFromMe}`);
      // Run in background to not block the worker
      handleIncomingMessage(orgId, from, messageText, isFromMe, pushName, whatsappMessageId).catch(err => {
         console.error('[WEBHOOK] Async handler error:', err);
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[WEBHOOK ERROR]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
