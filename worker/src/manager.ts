import makeWASocket, {
  DisconnectReason,
  WASocket,
  isJidBroadcast,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  BufferJSON
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { supabaseAdmin } from './supabase';
import { useSupabaseAuthState } from './auth';
import pino from 'pino';
import NodeCache from 'node-cache';
import { historyManager } from './history';
import { EventEmitter } from 'events';

// Global emitter for session updates
export const sessionEmitter = new EventEmitter();

// State maps
const sessions = new Map<string, WASocket>();
const sessionStates = new Map<string, any>();
const recentlySentMessageIds = new Set<string>();
const msgRetryCounterCache = new NodeCache();
const groupCache = new NodeCache({ stdTTL: 5 * 60, useClones: false });

/**
 * Helper to update status in DB
 */
async function updateDbStatus(orgId: string, status: string) {
  try {
    await supabaseAdmin
      .from('organizations')
      .update({ whatsapp_status: status })
      .eq('id', orgId);
    console.log(`[BAILEYS] Updated DB status for ${orgId} to ${status}`);
  } catch (error) {
    console.error(`[BAILEYS] Failed to update DB status for ${orgId}:`, error);
  }
}

/**
 * Clear auth state for an organization
 */
async function clearAuthState(orgId: string): Promise<void> {
  try {
    console.log(`[BAILEYS] Clearing auth state for ${orgId}...`);
    const { error } = await supabaseAdmin
      .from('whatsapp_sessions')
      .delete()
      .eq('session_id', orgId);
      
    if (error) {
        console.error(`[BAILEYS] Supabase delete error:`, error);
        throw error;
    }
    console.log(`[BAILEYS] Cleared auth state for ${orgId}`);
    
    // Safety delay to ensure DB consistency
    await new Promise(r => setTimeout(r, 1000));
  } catch (error) {
    console.log(`[BAILEYS] Error clearing auth state for ${orgId}:`, error);
  }
}

/**
 * Create or get existing Baileys session
 */
export async function getOrCreateSession(orgId: string, forceNew: boolean = false): Promise<WASocket> {
  console.log(`[BAILEYS] getOrCreateSession for ${orgId}, forceNew: ${forceNew}`);

  if (forceNew && sessions.has(orgId)) {
    const oldSock = sessions.get(orgId);
    try {
      console.log(`[BAILEYS] Closing old session for ${orgId}`);
      await oldSock?.end(undefined);
    } catch (e) {}
    sessions.delete(orgId);
    sessionStates.delete(orgId);
  }

  if (sessions.has(orgId)) {
    return sessions.get(orgId)!;
  }

  console.log(`[BAILEYS] Loading auth state for ${orgId}...`);
  const { state, saveCreds } = await useSupabaseAuthState(orgId);
  
  console.log(`[BAILEYS] Fetching latest Baileys version...`);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`[BAILEYS] Using WA v${version.join('.')}, isLatest: ${isLatest}`);
  
  const sock = makeWASocket({
    version,
    auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }) as any),
    },
    printQRInTerminal: false,
    browser: ['Ubuntu', 'Chrome', '20.0.00'],
    logger: pino({ level: 'silent' }) as any,
    msgRetryCounterCache,
    generateHighQualityLinkPreview: true,
    markOnlineOnConnect: false,
    syncFullHistory: true, // Enable full history sync
    cachedGroupMetadata: async (jid) => groupCache.get(jid),
    getMessage: async (key) => {
        // Placeholder for message retrieval if needed for retries
        return undefined;
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log(`[BAILEYS] QR Code generated for ${orgId}`);
      const newState = { status: 'qr', qr };
      sessionStates.set(orgId, newState);
      sessionEmitter.emit(`update:${orgId}`, newState);
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(`[BAILEYS] Connection closed for ${orgId}, reconnecting:`, shouldReconnect);
      
      await updateDbStatus(orgId, 'disconnected');
      
      if (shouldReconnect) {
        sessions.delete(orgId);
        getOrCreateSession(orgId);
      } else {
        console.log(`[BAILEYS] Permanent logout for ${orgId}. Cleaning up...`);
        sessions.delete(orgId);
        sessionStates.delete(orgId);
        
        try {
            await sock.logout();
            sock.end(undefined);
        } catch (e) {}

        const newState = { status: 'logged_out' };
        sessionStates.set(orgId, newState);
        sessionEmitter.emit(`update:${orgId}`, newState);
        await updateDbStatus(orgId, 'logged_out');
        await clearAuthState(orgId);
      }
    } else if (connection === 'open') {
      console.log(`[BAILEYS] Connected for ${orgId}`);
      const newState = { status: 'connected' };
      sessionStates.set(orgId, newState);
      sessionEmitter.emit(`update:${orgId}`, newState);
      await updateDbStatus(orgId, 'connected');
    }
  });

  sock.ev.on('groups.update', async (updates) => {
      for (const update of updates) {
          if (update.id) {
              groupCache.del(update.id);
          }
      }
  });
  
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
      // Intercept history (append) messages
      if (type === 'append') {
          console.log(`[BAILEYS] Received ${messages.length} history messages for ${orgId}`);
          await historyManager.queueMessages(orgId, messages);
          return; // Stop here, do not forward to webhook
      }

      for (const msg of messages) {
          // Rule 1: Ignore Broadcasts
          if (isJidBroadcast(msg.key.remoteJid || '')) continue;

          // Rule 2: Handle "From Me"
          if (msg.key.fromMe) {
              // If we (AI/System) sent it, we added it to recentlySentMessageIds.
              // If it's there, IGNORE it.
              if (msg.key.id && recentlySentMessageIds.has(msg.key.id)) {
                  console.log(`[WORKER] Ignoring AI/System message ${msg.key.id}`);
                  continue;
              }
              // If it's NOT there, it was sent by the Human Owner on their phone. ALLOW it.
              console.log(`[WORKER] Detected HUMAN OWNER message ${msg.key.id}`);
          }

          console.log(`[WORKER] Processing message from ${msg.key.remoteJid} (fromMe: ${msg.key.fromMe})`);
          console.log(`[WORKER] Full Message Key:`, JSON.stringify(msg.key, null, 2));
             
             // Forward to Next.js App
             try {
                 const webhookUrl = process.env.WEBHOOK_URL || 'http://localhost:3001/api/webhooks/whatsapp';
                 const secret = process.env.WORKER_SECRET || 'dev-secret';
                 
                 // We need to use native fetch in Node 18+
                 await fetch(webhookUrl, {
                     method: 'POST',
                     headers: {
                         'Content-Type': 'application/json',
                         'x-worker-secret': secret
                     },
                     body: JSON.stringify({
                         orgId,
                         message: msg,
                         type
                     })
                 });
             } catch (e) {
                 console.error('[WORKER] Failed to forward message to webhook:', e);
             }
      }
  });

  sessions.set(orgId, sock);
  return sock;
}

export async function requestPairingCode(orgId: string, phoneNumber: string): Promise<string> {
    // 1. Force kill existing session to ensure clean slate
    if (sessions.has(orgId)) {
        console.log(`[BAILEYS] Killing existing session for ${orgId} before pairing request`);
        await logoutSession(orgId);
    }
    
    // 2. Create NEW session
    const sock = await getOrCreateSession(orgId);
    
    // 3. Request logic based on official example
    if (!sock.authState.creds.registered) {
        let cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
        if (cleanNumber.startsWith('0')) cleanNumber = '972' + cleanNumber.substring(1);
        cleanNumber = cleanNumber.replace(/^\+/, '');

    console.log(`[BAILEYS] Requesting pairing code for ${orgId} with ${cleanNumber}`);
    
    // 3. Wait for the socket to emit a QR code or Open event.
    // This is the most reliable way to know the socket is "ready" to talk to WA servers for pairing.
    console.log(`[BAILEYS] Waiting for internal connection (QR event)...`);
    
    await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
            // If we timed out but the socket IS open, maybe we can try anyway?
            // But usually we should have gotten a QR by now (standard is < 2s)
            console.log('[BAILEYS] Timeout waiting for QR. Checking socket state...');
             // @ts-ignore
            if (sock.ws && sock.ws.isOpen) {
                 resolve();
            } else {
                 reject(new Error('Connection/QR timeout - Socket not ready'));
            }
        }, 10000); // Wait up to 10s for initial connection

        const listener = (update: any) => {
             const { connection, qr } = update;
             if (qr) {
                 console.log('[BAILEYS] Socket is ready (QR received). Proceeding to pairing code.');
                 sock.ev.off('connection.update', listener);
                 clearTimeout(timeout);
                 resolve();
             }
             if (connection === 'open') {
                 sock.ev.off('connection.update', listener);
                 clearTimeout(timeout);
                 resolve();
             }
        };

        sock.ev.on('connection.update', listener);
        
        // Check if we already have a QR?
        // sessionStates is updated in the event listener in getOrCreateSession.
        const currentState = sessionStates.get(orgId);
        if (currentState?.status === 'qr') {
             sock.ev.off('connection.update', listener);
             clearTimeout(timeout);
             resolve();
        }
    });

    console.log(`[BAILEYS] Sending pairing code request now...`);
    const code = await sock.requestPairingCode(cleanNumber);
    console.log(`[BAILEYS] Code received: ${code}`);
    return code;
    } else {
        // Session is already registered. This might be a mistake or a stuck state.
        // If the user is requesting a pairing code, they probably want to re-pair.
        console.log(`[BAILEYS] Session claims to be registered but user requested pairing code. Forcing logout...`);
        await logoutSession(orgId);
        
        // Retry once recursively
        // We need to get a new socket after logout
        const newSock = await getOrCreateSession(orgId);
        if (!newSock.authState.creds.registered) {
             console.log(`[BAILEYS] Retrying pairing code request after force logout...`);
             return requestPairingCode(orgId, phoneNumber);
        } else {
             throw new Error('Session is stuck in registered state even after logout');
        }
    }
}

export async function sendMessage(orgId: string, to: string, message: string): Promise<any> {
  const sock = await getOrCreateSession(orgId);
  
  // Ensure number has @s.whatsapp.net suffix
  const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
  
  // Generate ID upfront to prevent race condition with upsert event
  // Use a simple random ID if Baileys util not avail, or rely on sock to respect passed ID
  const messageId = `3EB0${crypto.randomUUID().replace(/-/g, '').substring(0, 18).toUpperCase()}`;

  // Add to Ignore Set BEFORE sending
  recentlySentMessageIds.add(messageId);
  // Auto-expire after 30 seconds
  setTimeout(() => recentlySentMessageIds.delete(messageId), 30000);

  console.log(`[WORKER] Sending message with ID ${messageId}...`);

  try {
      const sentMsg = await sock.sendMessage(jid, { text: message }, { messageId });
      console.log(`[WORKER] Message sent from ${orgId} to ${to} (ID: ${sentMsg?.key?.id})`);
      return sentMsg;
  } catch (error) {
      // If failed, remove from set to avoid memory leak (though TTL handles it)
      recentlySentMessageIds.delete(messageId);
      throw error;
  }
}

export function getSessionStatus(orgId: string) {
  return sessionStates.get(orgId) || { status: 'not_started' };
}


export async function logoutSession(orgId: string) {
    const sock = sessions.get(orgId);
    if (sock) await sock.logout();
    sessions.delete(orgId);
    sessionStates.delete(orgId);
    await clearAuthState(orgId);
    await updateDbStatus(orgId, 'logged_out');
}

/**
 * Initialize all active sessions on worker startup
 */
export async function initAllActiveSessions() {
    console.log('[BAILEYS] Initializing all active sessions...');
    
    const { data: orgs, error } = await supabaseAdmin
        .from('organizations')
        .select('id')
        .eq('whatsapp_status', 'connected');

    if (error || !orgs) {
        console.error('[BAILEYS] Failed to fetch active orgs:', error);
        return;
    }

    console.log(`[BAILEYS] Found ${orgs.length} active sessions to restore.`);

    // Batch process to avoid CPU spike
    const BATCH_SIZE = 5;
    const DELAY_MS = 2000;

    for (let i = 0; i < orgs.length; i += BATCH_SIZE) {
        const batch = orgs.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (org) => {
            try {
                await getOrCreateSession(org.id);
                console.log(`[BAILEYS] Restored session for ${org.id}`);
            } catch (e) {
                console.error(`[BAILEYS] Failed to restore session for ${org.id}:`, e);
            }
        }));
        
        if (i + BATCH_SIZE < orgs.length) {
            console.log(`[BAILEYS] Waiting ${DELAY_MS}ms before next batch...`);
            await new Promise(r => setTimeout(r, DELAY_MS));
        }
    }
    
    console.log('[BAILEYS] All active sessions restored.');
}
