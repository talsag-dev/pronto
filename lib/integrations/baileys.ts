
const WORKER_URL = process.env.WHATSAPP_WORKER_URL || 'http://localhost:4000';
const WORKER_SECRET = process.env.WORKER_SECRET || 'dev-secret';

async function fetchWorker(path: string, options: RequestInit = {}) {
  const res = await fetch(`${WORKER_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-worker-secret': WORKER_SECRET,
      ...options.headers,
    },
    cache: 'no-store'
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  
  return res.json();
}


/**
 * Ensure session exists in worker
 */
export async function ensureWorkerSession(orgId: string) {
  try {
     await fetchWorker(`/session/${orgId}/init`, {
         method: 'POST',
         body: JSON.stringify({ forceNew: false })
     });
     console.log(`[BAILEYS CLIENT] Ensured session for ${orgId}`);
  } catch (e) {
     console.error(`[BAILEYS CLIENT] Failed to ensure session for ${orgId}:`, e);
  }
}


/**
 * Get QR code
 */
export async function getQRCode(orgId: string): Promise<string | null> {
  // Force new session init
  await fetchWorker(`/session/${orgId}/init`, {
      method: 'POST',
      body: JSON.stringify({ forceNew: true })
  });

  // Poll for QR
  const maxRetries = 10;
  for (let i = 0; i < maxRetries; i++) {
     try {
       const status = await fetchWorker(`/session/${orgId}/status`);
       if (status.qr) return status.qr;
       if (status.status === 'connected') return null;
     } catch (e) {}
     await new Promise(r => setTimeout(r, 1000));
  }
  return null;
}

/**
 * Request Pairing Code
 */
export async function requestPairingCode(orgId: string, phoneNumber: string): Promise<string> {
   const res = await fetchWorker(`/session/${orgId}/pairing-code`, {
       method: 'POST',
       body: JSON.stringify({ phoneNumber })
   });
   return res.code;
}

/**
 * Send Message
 */
export async function sendMessage(orgId: string, to: string, message: string): Promise<void> {
    await fetchWorker(`/session/${orgId}/message`, {
        method: 'POST',
        body: JSON.stringify({ to, message })
    });
}

/**
 * Get Status
 */
export async function getSessionStatus(orgId: string): Promise<any> {
    return await fetchWorker(`/session/${orgId}/status`);
}


/**
 * Logout
 */
export async function logoutSession(orgId: string): Promise<void> {
    await fetchWorker(`/session/${orgId}`, { method: 'DELETE' });
}
