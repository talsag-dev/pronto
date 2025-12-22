'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, QrCode, CheckCircle2, RefreshCw, ArrowLeft, Hash } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function WhatsAppQRSettings() {
  const router = useRouter(); // Initialize router
  
  // Mode: 'qr' or 'phone'
  const [method, setMethod] = useState<'qr' | 'phone'>('qr');
  
  // State for QR
  const [qrCode, setQrCode] = useState<string | null>(null);
  
  // State for Phone Pairing
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pairingCode, setPairingCode] = useState<string | null>(null);

  // Common State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Animation variants
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  // Auto-redirect when connected
  useEffect(() => {
    if (connected) {
      const timeout = setTimeout(() => {
        router.push('/dashboard');
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [connected, router]);

  function stopSse() {
    if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
    }
  }

  function startSse() {
    stopSse();

    const es = new EventSource('/api/whatsapp/pairing/sse');
    eventSourceRef.current = es;

    es.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('[SSE] Received status update:', data);
            
            if (data.status === 'connected' || data.whatsapp_status === 'connected') {
                setConnected(true);
                setQrCode(null);
                setPairingCode(null);
                stopSse();
            } else if (data.qr) {
                setQrCode(data.qr);
            }
        } catch (e) {
            console.error('[SSE] Failed to parse message:', e);
        }
    };

    es.onerror = (error) => {
        console.error('[SSE] EventSource error:', error);
    };

    // Auto-stop after 2 mins to save resources
    setTimeout(stopSse, 120000);
  }

  // --- QR Logic ---
  async function handleGetQR() {
    setMethod('qr');
    setLoading(true);
    setError('');
    setQrCode(null);
    setPairingCode(null);
    setConnected(false);

    try {
      const res = await fetch('/api/whatsapp/qr-baileys');
      const data = await res.json();

      if (data.qr) {
        setQrCode(data.qr);
        startSse();
      } else {
        setError(data.error || 'Failed to get QR code');
      }
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  // --- Pairing Code Logic ---
  async function handleGetPairingCode() {
    if (!phoneNumber) {
        setError('Please enter a phone number');
        return;
    }

    setLoading(true);
    setError('');
    setQrCode(null);
    setPairingCode(null);
    setConnected(false);

    try {
      const res = await fetch('/api/whatsapp/pairing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber })
      });
      const data = await res.json();

      if (data.code) {
        setPairingCode(data.code);
        startSse();
      } else {
        setError(data.error || 'Failed to get pairing code');
      }
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    return () => stopSse();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50/50 p-6 md:p-12">
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="max-w-4xl mx-auto space-y-8"
      >
        {/* Header */}
        <motion.div variants={item} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 bg-linear-to-br from-green-500 to-green-600 rounded-2xl shadow-lg shadow-green-500/30 flex items-center justify-center shrink-0">
              <QrCode size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Connect WhatsApp</h1>
              <p className="text-slate-500 font-medium">Choose your preferred method</p>
            </div>
          </div>
          
          <Link href="/dashboard">
            <button className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-full shadow-sm text-slate-700 font-medium transition-colors inline-flex items-center gap-2">
              <ArrowLeft size={18} />
              Back to Dashboard
            </button>
          </Link>
        </motion.div>

        {/* Error Alert */}
        <AnimatePresence>
            {error && (
            <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 bg-red-50 border border-red-200 rounded-2xl shadow-sm"
            >
                <p className="text-red-600 font-medium">{error}</p>
            </motion.div>
            )}
        </AnimatePresence>

        {/* Main Card */}
        <motion.div variants={item} className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          
          {/* Tabs */}
          {!connected && (
              <div className="flex border-b border-slate-100">
                  <button 
                    onClick={() => { setMethod('qr'); setPairingCode(null); setError(''); }}
                    className={`flex-1 py-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${method === 'qr' ? 'bg-green-50 text-green-700 border-b-2 border-green-500' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                      <QrCode size={18} />
                      Scan QR Code
                  </button>
                  <button 
                    onClick={() => { setMethod('phone'); setQrCode(null); setError(''); }}
                    className={`flex-1 py-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${method === 'phone' ? 'bg-green-50 text-green-700 border-b-2 border-green-500' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                      <Hash size={18} />
                      Use Pairing Code
                  </button>
              </div>
          )}

          <div className="p-8 md:p-12">
            
            {/* Connected State */}
            {connected ? (
                <div className="text-center space-y-6">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
                    <CheckCircle2 size={40} className="text-green-600" />
                </div>
                
                <div>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 rounded-full mb-4">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-semibold text-green-700">Connected</span>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">WhatsApp Connected!</h2>
                    <p className="text-slate-500">Your WhatsApp is now linked and ready.</p>
                </div>

                <div className="pt-4">
                    <button 
                        onClick={async () => {
                            if (!confirm('Are you sure you want to disconnect?')) return;
                            setLoading(true);
                            try {
                                const res = await fetch('/api/whatsapp/session', { method: 'DELETE' });
                                const json = await res.json();
                                if (json.success) {
                                    setConnected(false);
                                    setQrCode(null);
                                    setPairingCode(null);
                                    window.location.reload(); // Refresh to ensure clean state
                                } else {
                                    setError(json.error || 'Failed to disconnect');
                                }
                            } catch (e) {
                                setError('Failed to disconnect');
                            } finally {
                                setLoading(false);
                            }
                        }}
                        disabled={loading}
                        className="text-red-600 hover:text-red-700 font-medium text-sm hover:underline disabled:opacity-50"
                    >
                        {loading ? 'Disconnecting...' : 'Disconnect WhatsApp'}
                    </button>
                </div>
                </div>
            ) : (
                <>
                    {/* Method: QR Code */}
                    {method === 'qr' && (
                        <div className="text-center">
                            {!qrCode ? (
                                <div className="space-y-6">
                                    <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-100 rounded-full mb-4">
                                        <QrCode size={40} className="text-slate-400" />
                                    </div>
                                    <p className="text-slate-500">Generate a QR code to scan with WhatsApp on your phone.</p>
                                    <button
                                        onClick={handleGetQR}
                                        disabled={loading}
                                        className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-full shadow-lg transition-all flex items-center gap-2 mx-auto disabled:opacity-50"
                                    >
                                        {loading ? 'Generating...' : 'Generate QR Code'}
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="p-4 bg-white border-2 border-slate-100 rounded-xl inline-block shadow-sm">
                                        <Image src={qrCode} alt="QR" width={260} height={260} />
                                    </div>
                                    <p className="text-sm text-slate-500">Open WhatsApp &gt; Linked Devices &gt; Link a Device &gt; Scan</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Method: Pairing Code */}
                    {method === 'phone' && (
                        <div className="text-center max-w-md mx-auto">
                            {!pairingCode ? (
                                <div className="space-y-6">
                                    <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-100 rounded-full mb-4">
                                        <Smartphone size={40} className="text-slate-400" />
                                    </div>
                                    <p className="text-slate-500">Enter your phone number to receive a temporary code.</p>
                                    
                                    <div className="flex gap-2">
                                        <input 
                                            type="tel" 
                                            placeholder="e.g. +972 54 123 4567"
                                            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all font-mono"
                                            value={phoneNumber}
                                            onChange={(e) => setPhoneNumber(e.target.value)}
                                        />
                                    </div>
                                    <p className="text-xs text-slate-400 text-left pl-2">Format: Country Code + Number (e.g. 972...)</p>

                                    <button
                                        onClick={handleGetPairingCode}
                                        disabled={loading || !phoneNumber}
                                        className="w-full px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-full shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {loading ? 'Getting Code...' : 'Get Pairing Code'}
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    <div className="p-6 bg-slate-900 rounded-2xl shadow-xl">
                                        <p className="text-slate-400 text-sm mb-2 uppercase tracking-wider font-semibold">Pairing Code</p>
                                        <div className="flex items-center justify-center gap-1 font-mono text-4xl font-bold text-white tracking-[0.2em]">
                                            {pairingCode.split('').map((char, i) => (
                                                <span key={i} className="inline-block">{char}</span>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <div className="text-left space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                        <h3 className="font-bold text-slate-900">Instructions:</h3>
                                        <ol className="list-decimal list-inside space-y-2 text-slate-600 text-sm">
                                            <li>Open WhatsApp on your phone</li>
                                            <li>Go to <b>Settings &gt; Linked Devices</b></li>
                                            <li>Tap <b>Link a Device</b></li>
                                            <li>Tap <b>Link with phone number instead</b></li>
                                            <li>Enter the code shown above</li>
                                        </ol>
                                    </div>

                                    <button 
                                        onClick={() => setPairingCode(null)}
                                        className="text-slate-400 hover:text-slate-600 text-sm underline"
                                    >
                                        Try different number
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

          </div>
        </motion.div>

      </motion.div>
    </main>
  );
}
