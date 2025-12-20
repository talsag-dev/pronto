'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Smartphone, QrCode, CheckCircle2, RefreshCw, ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function WhatsAppQRSettings() {
  const router = useRouter(); // Initialize router
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Check status on mount in case already connected
  // Commented out to allow QR regeneration even if in-memory state shows connected
  // useEffect(() => {
  //   checkStatus();
  // }, []);

  // Auto-redirect when connected
  useEffect(() => {
    if (connected) {
      const timeout = setTimeout(() => {
        router.push('/dashboard');
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [connected, router]);

  async function checkStatus() {
    try {
      const res = await fetch('/api/whatsapp/pairing?action=status');
      const data = await res.json();
      console.log('[WhatsApp QR] Status:', data);
      
      // Check both in-memory status and persistent DB status
      if (data.status === 'connected' || data.whatsapp_status === 'connected') {
        setConnected(true);
        setQrCode(null);
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }
    } catch (e) {
      console.error('[WhatsApp QR] Status check error:', e);
    }
  }

  async function handleGetQR() {
    setLoading(true);
    setError('');
    setQrCode(null);
    setConnected(false);

    try {
      const res = await fetch('/api/whatsapp/qr-baileys');
      const data = await res.json();

      if (data.qr) {
        setQrCode(data.qr);
        startPolling();
      } else {
        setError(data.error || 'Failed to get QR code');
      }
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function startPolling() {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    pollingIntervalRef.current = setInterval(checkStatus, 2000);

    setTimeout(() => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }, 120000);
  }

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
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
            <div className="h-14 w-14 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-lg shadow-green-500/30 flex items-center justify-center shrink-0">
              <QrCode size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Connect WhatsApp</h1>
              <p className="text-slate-500 font-medium">QR Code Method</p>
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
        {error && (
          <motion.div variants={item} className="p-4 bg-red-50 border border-red-200 rounded-2xl shadow-sm">
            <p className="text-red-600 font-medium">{error}</p>
          </motion.div>
        )}

        {/* Main Card */}
        <motion.div variants={item} whileHover={{ y: -4 }} className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
          
          {/* Not Connected State */}
          {!qrCode && !connected && (
            <div className="p-8 md:p-12 text-center space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-100 rounded-full mb-4">
                <Smartphone size={40} className="text-slate-400" />
              </div>
              
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-full mb-4">
                  <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                  <span className="text-sm font-semibold text-slate-600">Not Connected</span>
                </div>
                <p className="text-slate-500 mt-2">Click below to generate a QR code</p>
              </div>

              <button
                onClick={handleGetQR}
                disabled={loading}
                className="px-8 py-4 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white font-semibold rounded-full shadow-lg shadow-green-600/30 hover:shadow-xl transition-all disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw size={20} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <QrCode size={20} />
                    Generate QR Code
                  </>
                )}
              </button>
            </div>
          )}

          {/* QR Code Display */}
          {qrCode && !connected && (
            <div className="p-8 md:p-12">
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full mb-2">
                  <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </div>
                  <span className="text-sm font-semibold text-blue-600">Waiting for Scan</span>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-8 items-center">
                {/* QR Code */}
                <div className="flex-shrink-0">
                  <div className="p-6 bg-white rounded-2xl border-4 border-slate-100 shadow-lg">
                    <Image
                      src={qrCode}
                      alt="WhatsApp QR Code"
                      width={280}
                      height={280}
                      className="rounded-lg"
                    />
                  </div>
                  <button
                    onClick={handleGetQR}
                    className="mt-4 w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-full transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={16} />
                    Refresh QR Code
                  </button>
                </div>

                {/* Instructions */}
                <div className="flex-1 space-y-4">
                  <h3 className="text-xl font-bold text-slate-900 mb-4">How to scan:</h3>
                  <div className="space-y-3">
                    {[
                      'Open WhatsApp on your phone',
                      'Go to Settings → Linked Devices',
                      'Tap "Link a Device"',
                      'Scan this QR code'
                    ].map((step, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold text-sm shrink-0">
                          {i + 1}
                        </div>
                        <p className="text-slate-600 font-medium">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Connected State */}
          {connected && (
            <div className="p-8 md:p-12 text-center space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
                <CheckCircle2 size={40} className="text-green-600" />
              </div>
              
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 rounded-full mb-4">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-semibold text-green-700">Connected</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">WhatsApp Connected!</h2>
                <p className="text-slate-500">Your WhatsApp is now linked and ready to receive messages</p>
                <p className="text-slate-400 text-sm mt-4 animate-pulse">Taking you back to dashboard...</p>
              </div>
            </div>
          )}
        </motion.div>

      </motion.div>
    </main>
  );
}
