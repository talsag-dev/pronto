import makeWASocket, {
  DisconnectReason,
  WASocket,
  proto,
  isJidBroadcast,
  isJidStatusBroadcast
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { supabaseAdmin } from '@/lib/supabase';
import { useSupabaseAuthState } from './baileys-supabase-auth';

// ... (existing code)

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



// Store active sessions in memory - use global for HMR support
// Store active sessions in memory - use global for HMR support
const globalForBaileys = globalThis as unknown as {
  baileysSessions: Map<string, WASocket>;
  baileysStates: Map<string, any>;
  baileysMessageHandlers: Map<string, (from: string, message: string, isFromMe: boolean) => Promise<void>>;
};

const sessions = globalForBaileys.baileysSessions || new Map<string, WASocket>();
const sessionStates = globalForBaileys.baileysStates || new Map<string, any>();
const messageHandlers = globalForBaileys.baileysMessageHandlers || new Map<string, (from: string, message: string, isFromMe: boolean) => Promise<void>>();

if (process.env.NODE_ENV !== 'production') {
  globalForBaileys.baileysSessions = sessions;
  globalForBaileys.baileysStates = sessionStates;
  globalForBaileys.baileysMessageHandlers = messageHandlers;
}

/**
 * Clear auth state for an organization
 */
async function clearAuthState(orgId: string): Promise<void> {
  try {
    // Delete from Supabase
    const { error } = await supabaseAdmin
      .from('whatsapp_sessions')
      .delete()
      .eq('session_id', orgId);
      
    if (error) throw error;
    
    console.log(`[BAILEYS] Cleared auth state for ${orgId}`);
  } catch (error) {
    console.log(`[BAILEYS] Error clearing auth state for ${orgId}:`, error);
  }
}

// Helper to attach handler to socket
function attachHandler(sock: WASocket, handler: (from: string, message: string, isFromMe: boolean) => Promise<void>) {
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    // Log for debugging
    console.log(`[BAILEYS] messages.upsert type=${type} count=${messages.length}`);

    for (const msg of messages) {
      // Ignore broadcast and status messages
      if (isJidBroadcast(msg.key.remoteJid!) || isJidStatusBroadcast(msg.key.remoteJid!)) {
        continue;
      }

      const from = msg.key.remoteJid!;
      const isFromMe = msg.key.fromMe || false;
      
      console.log(`[BAILEYS] Processing msg from=${from} isFromMe=${isFromMe} type=${type}`);

      // Filter out old messages (older than 24 hours) 
      // This prevents processing entire history syncs as new activity
      if (msg.messageTimestamp) {
        let messageTime = 0;
        const ts = msg.messageTimestamp;

        if (typeof ts === 'number') {
          messageTime = ts * 1000;
        } else if (typeof ts === 'string') {
          messageTime = parseInt(ts) * 1000;
        } else if (typeof ts === 'object') {
           // Handle Long object (low/high/unsigned) or generic object
           if ('toNumber' in ts && typeof (ts as any).toNumber === 'function') {
             messageTime = (ts as any).toNumber() * 1000;
           } else if ('low' in ts) {
             messageTime = (ts as any).low * 1000;
           } else {
             messageTime = Number(ts) * 1000;
           }
        }

        // Validate calculated time
        if (messageTime > 0) {
           const date = new Date(messageTime);
           console.log(`[BAILEYS] Msg timestamp: ${date.toISOString()} (Now: ${new Date().toISOString()})`);
           
           // Use 24 hour window to be safe against timezone/sync delays
           if (Date.now() - messageTime > 24 * 60 * 60 * 1000) {
             console.log('[BAILEYS] Skipping old message');
             continue;
           }
        }
      }

      const messageText = msg.message?.conversation || 
                         msg.message?.extendedTextMessage?.text || 
                         '';

      if (messageText) {
        console.log(`[BAILEYS] Passing to handler: ${messageText.substring(0, 20)}...`);
        await handler(from, messageText, isFromMe);
      } else {
        console.log('[BAILEYS] No message text found');
      }
    }
  });
}

/**
 * Setup message handler for an organization
 */
export async function setupMessageHandler(
  orgId: string,
  handler: (from: string, message: string, isFromMe: boolean) => Promise<void>
) {
  // 1. Store handler in global map
  messageHandlers.set(orgId, handler);
  console.log(`[BAILEYS] Registered message handler for ${orgId}`);

  // 2. If session exists, attach immediately
  if (sessions.has(orgId)) {
    const sock = sessions.get(orgId)!;
    attachHandler(sock, handler);
  } else {
    // 3. If no session, create one (which will pick up the handler)
    await getOrCreateSession(orgId);
  }
}

/**
 * Create or get existing Baileys session
 */
export async function getOrCreateSession(orgId: string, forceNew: boolean = false): Promise<WASocket> {
  // Force new session if requested (for QR code generation)
  if (forceNew && sessions.has(orgId)) {
    const oldSock = sessions.get(orgId);
    try {
      await oldSock?.end(undefined);
    } catch (e) {
      // Ignore errors
    }
    sessions.delete(orgId);
    sessionStates.delete(orgId);
  }

  // Return existing session if available
  if (sessions.has(orgId)) {
    return sessions.get(orgId)!;
  }

  // Create new session
  const { state, saveCreds } = await useSupabaseAuthState(orgId);
  
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ['Pronto', 'Chrome', '1.0.0'],
    defaultQueryTimeoutMs: undefined,
    // Suppress non-fatal sync errors
    logger: {
      level: 'warn',
      fatal: console.error,
      error: (msg: any) => {
        // Filter out expected sync errors that self-recover
        if (typeof msg === 'object' && msg.msg?.includes('failed to sync state from version')) {
          return; // Suppress
        }
        console.error(msg);
      },
      warn: console.warn,
      info: () => {}, // Suppress info
      debug: () => {}, // Suppress debug
      trace: () => {}, // Suppress trace
      child: function() { return this; },
    } as any,
  });

  // Save credentials on update
  sock.ev.on('creds.update', saveCreds);

  // Re-attach message handler if it exists
  const handler = messageHandlers.get(orgId);
  if (handler) {
    console.log(`[BAILEYS] Attaching persisted message handler to new socket for ${orgId}`);
    attachHandler(sock, handler);
  }

  // Handle connection updates
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log(`[BAILEYS] QR Code generated for ${orgId}`);
      sessionStates.set(orgId, { status: 'qr', qr });
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(`[BAILEYS] Connection closed for ${orgId}, reconnecting:`, shouldReconnect);
      
      // Update DB status
      await updateDbStatus(orgId, 'disconnected');
      
      if (shouldReconnect) {
        sessions.delete(orgId);
        await getOrCreateSession(orgId);
      } else {
        sessions.delete(orgId);
        sessionStates.delete(orgId); // Clear state on logout
        sessionStates.set(orgId, { status: 'logged_out' });
        await updateDbStatus(orgId, 'logged_out');
      }
    } else if (connection === 'open') {
      console.log(`[BAILEYS] Connected for ${orgId}`);
      sessionStates.set(orgId, { status: 'connected' });
      // Update DB status
      await updateDbStatus(orgId, 'connected');
    }
  });

  sessions.set(orgId, sock);
  return sock;
}

/**
 * Request pairing code for phone number
 */
export async function requestPairingCode(orgId: string, phoneNumber: string): Promise<string> {
  // Clean and format phone number
  let cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
  
  // If number starts with 0, assume it's Israeli and add country code
  if (cleanNumber.startsWith('0')) {
    cleanNumber = '972' + cleanNumber.substring(1);
  }
  
  // Ensure number doesn't start with +
  cleanNumber = cleanNumber.replace(/^\+/, '');
  
  console.log(`[BAILEYS] Requesting pairing code for ${orgId} with number: ${cleanNumber}`);
  
  // Retry logic: WhatsApp sometimes rejects pairing code requests
  const maxRetries = 3;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Create fresh session for each attempt
      if (attempt > 1) {
        console.log(`[BAILEYS] Retry attempt ${attempt}/${maxRetries} for ${orgId}`);
        // Delete old session and create new one
        sessions.delete(orgId);
        sessionStates.delete(orgId);
        await new Promise(resolve => setTimeout(resolve, attempt * 1000)); // Wait 1s, 2s, 3s
      }
      
      const sock = await getOrCreateSession(orgId);
      
      // Wait for connection to be established
      console.log(`[BAILEYS] Waiting for connection to be ready...`);
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 20000); // 20 second timeout
        
        const checkConnection = () => {
          const update = sessionStates.get(orgId);
          if (update?.status === 'qr' || update?.status === 'connected') {
            clearTimeout(timeout);
            resolve();
          }
        };
        
        // Check immediately
        checkConnection();
        
        // Check every 500ms
        const interval = setInterval(() => {
          checkConnection();
          if (sessionStates.get(orgId)?.status === 'qr' || sessionStates.get(orgId)?.status === 'connected') {
            clearInterval(interval);
          }
        }, 500);
      });
      
      console.log(`[BAILEYS] Connection ready, requesting pairing code...`);
      
      // Request pairing code
      const code = await sock.requestPairingCode(cleanNumber);
      
      console.log(`[BAILEYS] ✓ Pairing code for ${orgId}: ${code} (attempt ${attempt})`);
      return code;
    } catch (error: any) {
      lastError = error;
      console.error(`[BAILEYS] ✗ Attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        throw new Error(`Failed after ${maxRetries} attempts: ${error.message}`);
      }
    }
  }
  
  throw lastError || new Error('Failed to get pairing code');
}

/**
 * Send a WhatsApp message
 */
export async function sendMessage(orgId: string, to: string, message: string): Promise<void> {
  const sock = await getOrCreateSession(orgId);
  
  // Ensure number has @s.whatsapp.net suffix
  const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
  
  await sock.sendMessage(jid, { text: message });
  console.log(`[BAILEYS] Message sent from ${orgId} to ${to}`);
}

/**
 * Get session status
 */
export function getSessionStatus(orgId: string): { status: string; qr?: string } {
  const state = sessionStates.get(orgId);
  if (!state) {
    return { status: 'not_started' };
  }
  return state;
}

/**
 * Get QR code for scanning
 */
export async function getQRCode(orgId: string): Promise<string | null> {
  // Clear old auth state to prevent decrypt errors
  await clearAuthState(orgId);
  
  // Force create new session for QR code (avoid phone number conflicts)
  await getOrCreateSession(orgId, true);
  
  // Wait for QR code to be generated
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(null);
    }, 30000); // 30 second timeout
    
    const checkQR = () => {
      const state = sessionStates.get(orgId);
      if (state?.qr) {
        clearTimeout(timeout);
        resolve(state.qr);
      } else if (state?.status === 'connected') {
        clearTimeout(timeout);
        resolve(null); // Already connected
      }
    };
    
    // Check immediately
    checkQR();
    
    // Check every 500ms
    const interval = setInterval(() => {
      checkQR();
      const state = sessionStates.get(orgId);
      if (state?.qr || state?.status === 'connected') {
        clearInterval(interval);
      }
    }, 500);
  });
}

/**
 * Setup message handler for an organization
 */


/**
 * Logout and delete session
 */
export async function logoutSession(orgId: string): Promise<void> {
  const sock = sessions.get(orgId);
  if (sock) {
    await sock.logout();
    sessions.delete(orgId);
    sessionStates.delete(orgId);
  }
  await clearAuthState(orgId);
}
