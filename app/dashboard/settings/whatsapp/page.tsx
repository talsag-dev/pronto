'use client';

import { useState, useEffect } from 'react';
import { Card, Title, Text, Button, Badge } from '@tremor/react';

export default function WhatsAppSettings() {
  const [status, setStatus] = useState('LOADING');
  const [loading, setLoading] = useState(false);

  async function fetchStatus() {
    try {
      const res = await fetch('/api/whatsapp/session');
      const data = await res.json();
      setStatus(data.status);
    } catch (e) {
      console.error(e);
      setStatus('ERROR');
    }
  }

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000); // Poll every 3s
    return () => clearInterval(interval);
  }, []);

  async function handleAction(action: 'start' | 'stop') {
    setLoading(true);
    await fetch('/api/whatsapp/session', {
      method: 'POST',
      body: JSON.stringify({ action })
    });
    setLoading(false);
    fetchStatus();
  }

  return (
    <div className="p-10">
      <Title>Connect WhatsApp</Title>
      <Text>Scan the QR code to link your business number.</Text>

      <div className="mt-8">
        <Card className="max-w-md mx-auto text-center">
            <div className="mb-4">
                <Badge size="xl" color={status === 'WORKING' ? 'green' : 'yellow'}>
                    {status}
                </Badge>
            </div>

            {status === 'STOPPED' || status === 'FAILED' ? (
                <Button 
                    size="xl" 
                    loading={loading} 
                    onClick={() => handleAction('start')}
                >
                    Start Session
                </Button>
            ) : null}

            {status === 'STARTING' && <Text>Initializing...</Text>}

            {status === 'SCAN_QR_CODE' && (
                <div className="flex flex-col items-center">
                    <img 
                        src={`/api/whatsapp/session?action=qr&t=${Date.now()}`} 
                        alt="Scan QR" 
                        className="w-64 h-64 border p-2 rounded"
                    />
                    <Text className="mt-2 text-sm text-gray-500">Refresh page if QR expires</Text>
                </div>
            )}

            {status === 'WORKING' && (
                <div className="flex flex-col items-center">
                     <img 
                        src={`/api/whatsapp/session?action=screenshot&t=${Date.now()}`} 
                        alt="Connected" 
                        className="w-64 h-auto border p-2 rounded opacity-50"
                    />
                    <Text className="mt-4 font-bold text-green-600">
                        You are connected!
                    </Text>
                    <Button 
                        variant="secondary" 
                        color="red" 
                        className="mt-4"
                        onClick={() => handleAction('stop')}
                    >
                        Disconnect
                    </Button>
                </div>
            )}
        </Card>
      </div>
    </div>
  );
}
