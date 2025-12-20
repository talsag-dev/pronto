const WAHA_API_URL = process.env.WAHA_API_URL || 'http://localhost:3000';
const WAHA_API_KEY = process.env.WAHA_API_KEY;

type WahaSessionStatus = 'STOPPED' | 'STARTING' | 'SCAN_QR_CODE' | 'WORKING' | 'FAILED';

interface WahaSession {
  name: string;
  status: WahaSessionStatus;
  config?: any;
}

export async function getSession(sessionName: string): Promise<WahaSession | null> {
  try {
    const res = await fetch(`${WAHA_API_URL}/api/sessions/${sessionName}`, {
      headers: { 
        'Content-Type': 'application/json',
        ...(WAHA_API_KEY && { 'X-Api-Key': WAHA_API_KEY })
      }
    });
    
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Failed to fetch session');
    
    return await res.json();
  } catch (error) {
    console.error('Error getting Waha session:', error);
    return null;
  }
}

export async function startSession(sessionName: string) {
  try {
    // First check if session already exists
    const existing = await getSession(sessionName);
    if (existing && existing.status !== 'STOPPED') {
      console.log(`[WAHA] Session ${sessionName} already exists with status: ${existing.status}`);
      return existing; // Return existing session instead of error
    }

    const res = await fetch(`${WAHA_API_URL}/api/sessions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(WAHA_API_KEY && { 'X-Api-Key': WAHA_API_KEY })
      },
      body: JSON.stringify({
        name: sessionName,
        config: {
          webhooks: [
            {
              url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/whatsapp`,
              events: ['message', 'session.status']
            }
          ]
        }
      })
    });

    if (!res.ok) {
        const err = await res.text();
        // If session already exists, that's okay
        if (err.includes('already exists')) {
          console.log(`[WAHA] Session ${sessionName} already exists, continuing...`);
          return await getSession(sessionName);
        }
        throw new Error(`Failed to start session: ${err}`);
    }
    
    return await res.json();
  } catch (error) {
    console.error('Error starting Waha session:', error);
    throw error;
  }
}

export async function stopSession(sessionName: string) {
    try {
      const res = await fetch(`${WAHA_API_URL}/api/sessions/${sessionName}/stop`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            ...(WAHA_API_KEY && { 'X-Api-Key': WAHA_API_KEY })
        }
      });
      if (!res.ok) throw new Error('Failed to stop session');
      return true;
    } catch (error) {
      console.error('Error stopping session:', error);
      throw error;
    }
}

export async function getQR(sessionName: string): Promise<Blob | null> {
  try {
    const res = await fetch(`${WAHA_API_URL}/api/sessions/${sessionName}/auth/qr?format=image`, {
       headers: { 
        ...(WAHA_API_KEY && { 'X-Api-Key': WAHA_API_KEY })
       }
    });
    console.log(res,"res")
    if (!res.ok) return null;
    return await res.blob();
  } catch (error) {
    console.error('Error getting QR:', error);
    return null;
  }
}

export async function getScreenshot(sessionName: string): Promise<Blob | null> {
    try {
      const res = await fetch(`${WAHA_API_URL}/api/sessions/${sessionName}/screenshot`, {
         headers: { 
          ...(WAHA_API_KEY && { 'X-Api-Key': WAHA_API_KEY })
         }
      });
      
      if (!res.ok) return null;
      return await res.blob();
    } catch (error) {
      console.error('Error getting screenshot:', error);
      return null;
    }
  }

/**
 * Request a pairing code for phone number authentication
 * Alternative to QR code scanning
 */
export async function requestPairingCode(sessionName: string, phoneNumber: string): Promise<string | null> {
  try {
    const res = await fetch(`${WAHA_API_URL}/api/${sessionName}/auth/request-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(WAHA_API_KEY && { 'X-Api-Key': WAHA_API_KEY })
      },
      body: JSON.stringify({
        phoneNumber: phoneNumber // Format: +1234567890
      })
    });

    if (!res.ok) {
      const error = await res.text();
      console.error('Error requesting pairing code:', error);
      return null;
    }

    const data = await res.json();
    return data.code; // Returns 8-digit code like "ABCD-1234"
  } catch (error) {
    console.error('Error requesting pairing code:', error);
    return null;
  }
}
