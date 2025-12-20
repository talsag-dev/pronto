const META_API_VERSION = 'v18.0';
const META_GRAPH_API = `https://graph.facebook.com/${META_API_VERSION}`;

interface WhatsAppMessage {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text';
  text: {
    body: string;
  };
}

/**
 * Send a WhatsApp message using Cloud API
 */
export async function sendWhatsAppMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  message: string
) {
  const payload: WhatsAppMessage = {
    messaging_product: 'whatsapp',
    to: to,
    type: 'text',
    text: {
      body: message
    }
  };

  const response = await fetch(
    `${META_GRAPH_API}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`WhatsApp API Error: ${JSON.stringify(error)}`);
  }

  return await response.json();
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(code: string) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/whatsapp/callback`;

  const response = await fetch(
    `${META_GRAPH_API}/oauth/access_token?` +
    `client_id=${appId}&` +
    `client_secret=${appSecret}&` +
    `code=${code}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}`,
    { method: 'GET' }
  );

  if (!response.ok) {
    throw new Error('Failed to exchange code for token');
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Get WhatsApp Business Account details
 * Optional - only needed for production with verified business
 */
export async function getWhatsAppBusinessAccount(accessToken: string) {
  const wabaId = process.env.META_WABA_ID;
  
  if (!wabaId) {
    // For local testing without business verification
    return null;
  }
  
  const response = await fetch(
    `${META_GRAPH_API}/${wabaId}?fields=id,name,phone_numbers`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    return null; // Gracefully handle errors
  }

  return await response.json();
}
