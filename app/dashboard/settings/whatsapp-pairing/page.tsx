'use client';

import { useState } from 'react';
import { Card, Title, Text, Button, Badge, TextInput } from '@tremor/react';

export default function WhatsAppPairingSettings() {
  const [step, setStep] = useState<'phone' | 'code' | 'connected'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  async function handleGetCode() {
    if (!phoneNumber) {
      setError('Please enter your phone number');
      return;
    }

    setLoading(true);
    setError('');
    setStatusMessage('Requesting pairing code...');

    try {
      // Request pairing code (Baileys creates session automatically)
      const res = await fetch(`/api/whatsapp/pairing?action=code&phone=${encodeURIComponent(phoneNumber)}`);
      const data = await res.json();

      if (data.code) {
        setPairingCode(data.code);
        setStep('code');
        setStatusMessage('');
      } else {
        setError(data.error || 'Failed to get pairing code');
        setStatusMessage('');
      }
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
      setStatusMessage('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-10">
      <Title>Connect WhatsApp (Pairing Code)</Title>
      <Text>Link your WhatsApp number without scanning a QR code</Text>

      {statusMessage && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <Text className="text-blue-600">{statusMessage}</Text>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <Text className="text-red-600">{error}</Text>
        </div>
      )}

      <div className="mt-8">
        <Card className="max-w-md mx-auto">
          {step === 'phone' && (
            <div className="space-y-4">
              <div>
                <Text className="mb-2 font-medium">Enter Your WhatsApp Number</Text>
                <TextInput
                  placeholder="+972501234567 or 0501234567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={loading}
                />
                <Text className="text-xs text-gray-500 mt-1">
                  Israeli numbers: start with +972 or 0
                </Text>
              </div>
              <Button
                size="xl"
                onClick={handleGetCode}
                loading={loading}
                className="w-full"
              >
                Get Pairing Code
              </Button>
            </div>
          )}

          {step === 'code' && (
            <div className="space-y-4 text-center">
              <Badge size="xl" color="blue">PAIRING CODE</Badge>
              
              <div className="p-6 bg-blue-50 rounded-lg">
                <Text className="text-4xl font-mono font-bold text-blue-600">
                  {pairingCode}
                </Text>
              </div>

              <div className="text-left space-y-2 text-sm">
                <Text className="font-bold">Next Steps:</Text>
                <Text>1. Open WhatsApp on your phone</Text>
                <Text>2. Go to Settings → Linked Devices</Text>
                <Text>3. Tap "Link a Device"</Text>
                <Text>4. Tap "Link with phone number instead"</Text>
                <Text>5. Enter the code above</Text>
              </div>

              <Button
                variant="secondary"
                onClick={() => {
                  setStep('phone');
                  setPairingCode('');
                  setPhoneNumber('');
                }}
              >
                Start Over
              </Button>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-8 max-w-2xl mx-auto">
        <Card>
          <Title>Why Pairing Code?</Title>
          <div className="mt-4 space-y-2 text-sm">
            <Text>✅ No need to scan QR code with camera</Text>
            <Text>✅ Works on any device</Text>
            <Text>✅ Just type the code in WhatsApp</Text>
            <Text>✅ Same security as QR code</Text>
          </div>
        </Card>
      </div>
    </div>
  );
}
