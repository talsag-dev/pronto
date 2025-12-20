'use client';

import { useState, useEffect } from 'react';
import { Card, Title, Text, Button, Badge } from '@tremor/react';

export default function WhatsAppCloudSettings() {
  const [status, setStatus] = useState<'loading' | 'connected' | 'disconnected'>('loading');
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check connection status
    fetchStatus();

    // Check for OAuth callback params
    const params = new URLSearchParams(window.location.search);
    if (params.get('success')) {
      setStatus('connected');
      window.history.replaceState({}, '', '/dashboard/settings/whatsapp');
    }
    if (params.get('error')) {
      setError(params.get('error'));
    }
  }, []);

  async function fetchStatus() {
    try {
      const res = await fetch('/api/whatsapp/status');
      const data = await res.json();
      setStatus(data.connected ? 'connected' : 'disconnected');
      setPhoneNumber(data.phoneNumber);
      return data.orgId; // Return org ID for OAuth
    } catch (e) {
      setStatus('disconnected');
      return null;
    }
  }

  async function handleConnect() {
    // Get current org ID from API
    const orgId = await fetchStatus();
    
    if (!orgId) {
      setError('Failed to get organization ID');
      return;
    }
    
    const appId = process.env.NEXT_PUBLIC_META_APP_ID;
    const redirectUri = `${window.location.origin}/api/auth/whatsapp/callback`;
    
    const oauthUrl = 
      `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${appId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `state=${orgId}&` +
      `scope=whatsapp_business_management,whatsapp_business_messaging`;

    window.location.href = oauthUrl;
  }

  return (
    <div className="p-10">
      <Title>Connect WhatsApp (Official Cloud API)</Title>
      <Text>Connect your WhatsApp Business number via Facebook OAuth</Text>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <Text className="text-red-600">Error: {error}</Text>
        </div>
      )}

      <div className="mt-8">
        <Card className="max-w-md mx-auto text-center">
          <div className="mb-4">
            <Badge size="xl" color={status === 'connected' ? 'green' : 'gray'}>
              {status === 'loading' ? 'LOADING...' : status.toUpperCase()}
            </Badge>
          </div>

          {status === 'disconnected' && (
            <div className="space-y-4">
              <Text>Click below to connect your WhatsApp Business account</Text>
              <Button 
                size="xl" 
                onClick={handleConnect}
                className="w-full"
              >
                Connect with Facebook
              </Button>
              <Text className="text-xs text-gray-500">
                You'll be redirected to Facebook to authorize access
              </Text>
            </div>
          )}

          {status === 'connected' && phoneNumber && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 rounded-lg">
                <Text className="font-bold text-green-600">
                  ✓ Connected
                </Text>
                <Text className="text-sm mt-2">
                  Phone: {phoneNumber}
                </Text>
              </div>
              <Button 
                variant="secondary" 
                color="red"
                onClick={() => {
                  // TODO: Implement disconnect
                  alert('Disconnect functionality coming soon');
                }}
              >
                Disconnect
              </Button>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-8 max-w-2xl mx-auto">
        <Card>
          <Title>How it works</Title>
          <div className="mt-4 space-y-2 text-sm">
            <Text>1. Click "Connect with Facebook"</Text>
            <Text>2. Log in to your Facebook account</Text>
            <Text>3. Select your WhatsApp Business account</Text>
            <Text>4. Grant permissions to Pronto</Text>
            <Text>5. Done! Your WhatsApp is connected</Text>
          </div>
        </Card>
      </div>
    </div>
  );
}
