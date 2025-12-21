'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Sparkles, MessageSquare, Zap, Shield, ArrowRight, Chrome } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { ProntoLogo } from '../components/ProntoLogo';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LandingPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Check if user is already logged in
  useEffect(() => {
    // Check for auth code in URL (handle malformed redirects)
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      router.push(`/auth/callback?code=${code}&next=/dashboard`);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/dashboard');
      }
    });
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.push('/dashboard');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      console.error('Error signing in:', error.message);
      alert('Error signing in. Please try again.');
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'azure' | 'facebook') => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
          scopes: provider === 'azure' ? 'email openid profile offline_access' : undefined,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      console.error('Error signing in:', error.message);
      alert('Error signing in. Please try again.');
      setLoading(false);
    }
  };



  const colorMap: Record<string, { bg: string; text: string; icon: string }> = {
    green: { bg: 'bg-green-50', text: 'text-green-600', icon: 'bg-green-100' },
    yellow: { bg: 'bg-yellow-50', text: 'text-yellow-600', icon: 'bg-yellow-100' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', icon: 'bg-blue-100' }
  };

  return (
    <main className="h-screen w-full overflow-hidden bg-slate-50/50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 py-20 md:py-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center space-y-8"
          >
            {/* Logo/Brand */}
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-white rounded-full shadow-lg shadow-slate-200/50 border border-slate-100">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center overflow-hidden">
                <ProntoLogo className="w-full h-full" />
              </div>
              <span className="text-xl font-bold text-slate-900">Pronto</span>
            </div>

            {/* Hero Headline */}
            <div className="space-y-4">
              <h1 className="text-5xl md:text-7xl font-bold text-slate-900 tracking-tight">
                Intelligent Response
                <br />
                <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  System
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-slate-500 font-medium max-w-2xl mx-auto">
                Automate customer conversations with AI-powered WhatsApp integration
              </p>
            </div>

            {/* CTA */}
            <div className="pt-8 space-y-4">
              {/* Auth Card */}
              <div className="max-w-md mx-auto w-full bg-white rounded-2xl shadow-xl shadow-indigo-500/5 ring-1 ring-slate-200/50 overflow-hidden">
                <div className="p-1">
                  <AuthTabs 
                    loading={loading}
                    setLoading={setLoading}
                    handleGoogleSignIn={handleGoogleSignIn}
                    handleOAuthSignIn={handleOAuthSignIn}
                    supabase={supabase}
                    router={router}
                  />
                </div>
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
                  <p className="text-xs text-center text-slate-500">
                    Free to start • No credit card required • Secure
                  </p>
                </div>
              </div>

            </div>
          </motion.div>
        </div>
      </div>
    </main>
  );
}

function AuthTabs({ 
  loading, 
  setLoading, 
  handleGoogleSignIn, 
  handleOAuthSignIn,
  supabase,
  router 
}: any) {
  const [activeTab, setActiveTab] = useState<'social' | 'email'>('social');
  
  return (
    <div>
      <div className="grid grid-cols-2 p-1 bg-slate-100/50 rounded-t-xl gap-1">
        <button
          onClick={() => setActiveTab('social')}
          className={`py-2.5 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'social' 
              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5' 
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
          }`}
        >
          Social Login
        </button>
        <button
          onClick={() => setActiveTab('email')}
          className={`py-2.5 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'email' 
              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5' 
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
          }`}
        >
          Email
        </button>
      </div>

      <div className="p-6">
        {activeTab === 'social' ? (
          <div className="space-y-3">
             {/* Google */}
             <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full px-6 py-3 bg-white hover:bg-gray-50 disabled:bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-3 active:scale-[0.98]"
              >
                <svg width="20" height="20" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Continue with Google
              </button>

              {/* Microsoft */}
              <button
                onClick={() => handleOAuthSignIn('azure')}
                disabled={loading}
                className="w-full px-6 py-3 bg-white hover:bg-gray-50 disabled:bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-3 active:scale-[0.98]"
              >
                <svg width="20" height="20" viewBox="0 0 23 23" fill="none">
                  <path d="M0 0h10.9v10.9H0z" fill="#f25022"/>
                  <path d="M12.1 0H23v10.9H12.1z" fill="#00a4ef"/>
                  <path d="M0 12.1h10.9V23H0z" fill="#7fba00"/>
                  <path d="M12.1 12.1H23V23H12.1z" fill="#ffb900"/>
                </svg>
                Continue with Microsoft
              </button>

              {/* Facebook */}
              <button
                onClick={() => handleOAuthSignIn('facebook')}
                disabled={loading}
                className="w-full px-6 py-3 bg-[#1877f2] hover:bg-[#165dc7] disabled:bg-slate-400 border border-transparent rounded-xl text-white font-medium transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-3 active:scale-[0.98]"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Continue with Facebook
              </button>
          </div>
        ) : (
          <AuthForm 
            loading={loading} 
            setLoading={setLoading} 
            supabase={supabase} 
            router={router}
          />
        )}
      </div>
    </div>
  );
}


function AuthForm({ loading, setLoading, supabase, router }: { 
  loading: boolean; 
  setLoading: (l: boolean) => void;
  supabase: any;
  router: any;
}) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        alert('Check your email to confirm your account!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push('/dashboard');
      }
    } catch (error: any) {
      console.error('Error:', error.message);
      alert(error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleEmailAuth} className="space-y-4">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 ml-1">Email Address</label>
            <input
              id="email"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 ml-1">Password</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full px-6 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-slate-900/10 active:scale-[0.98]"
        >
          {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
        </button>
      </form>

      <div className="text-center">
        <button
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-xs text-slate-500 hover:text-indigo-600 font-medium transition-colors"
        >
          {isSignUp ? 'Already have an account? Sign in' : 'New to Pronto? Create an account'}
        </button>
      </div>
    </div>
  );
}
