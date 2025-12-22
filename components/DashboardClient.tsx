'use client';

import { useState, useEffect } from 'react';
import { Card, Title, Text, Metric, BarChart, Subtitle } from '@tremor/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, AlertCircle, CalendarCheck, Activity, Filter, User, LogOut, ChevronDown, Unplug, X } from 'lucide-react';
import { ProntoLogo } from './ProntoLogo';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { parsePhoneNumber } from 'libphonenumber-js';
import ChatInterface from './ChatInterface';
import { useMixpanel } from '../lib/hooks/use-mixpanel';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);



export default function DashboardClient({ leads: initialLeads = [], user: initialUser, whatsappStatus: initialStatus = 'not_started' }: { leads: any[], user?: any, whatsappStatus?: string }) {
  const router = useRouter();
  const [user, setUser] = useState<any>(initialUser);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState(initialStatus);
  const [selectedLead, setSelectedLead] = useState<any>(null); // New state
  const [leads, setLeads] = useState<any[]>(initialLeads);
  const { track } = useMixpanel();

  useEffect(() => {
    track('Dashboard Viewed', {
      user_email: user?.email,
      lead_count: leads.length,
      whatsapp_status: whatsappStatus
    });
  }, []);

  // Subscribe to real-time leads updates
  useEffect(() => {
    const channel = supabase
      .channel('leads-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'leads'
        },
        (payload) => {
          console.log('[REALTIME] Leads update received:', payload);
          if (payload.eventType === 'INSERT') {
            setLeads((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setLeads((prev) => 
              prev.map((lead) => lead.id === payload.new.id ? payload.new : lead)
            );
            // Also update selected lead if it's the one being updated
            setSelectedLead((current: any) => 
               (current?.id === payload.new.id) ? payload.new : current
            );
          } else if (payload.eventType === 'DELETE') {
             setLeads((prev) => prev.filter((lead) => lead.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const dismissLead = (leadId: string) => {
    setLeads(prev => prev.filter(l => l.id !== leadId));
  };

  // Fetch current user if not provided or to ensure freshness
  useEffect(() => {
    if (!user) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        setUser(user);
      });
    }
  }, [user]);

  // Fetch WhatsApp status and listen for real-time updates via SSE
  useEffect(() => {
    console.log('[SSE] Connecting to WhatsApp status stream...');
    const eventSource = new EventSource('/api/whatsapp/pairing/sse');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[SSE] Received status update:', data);
        
        if (data.status) {
           // If in-memory status is 'not_started' but DB says 'connected', 
           // we likely have a process isolation issue (Next.js env), but the bot is actually working.
           // Trust the DB in this specific case.
           if (data.status === 'not_started' && data.whatsapp_status === 'connected') {
             setWhatsappStatus('connected');
           } else {
             setWhatsappStatus(data.status);
           }
        }
      } catch (error) {
        console.error('[SSE] Failed to parse message:', error);
      }
    };

    eventSource.onerror = (error) => {
      // Downgrade to warn to avoid Next.js error overlay
      console.warn('[SSE] EventSource connection issue:', error);
    };

    return () => {
      console.log('[SSE] Closing WhatsApp status stream...');
      eventSource.close();
    };
  }, []);

  // Handle logout
  const handleLogout = async () => {
    track('Logout Clicked');
    await supabase.auth.signOut();
    router.push('/');
  };

  // Calculate specific metrics from real data if available, falling back to mock
  const totalLeads = leads.length;
  const newLeads = leads.filter(l => l.status === 'new').length;

  // Animation variants
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <main className="h-full w-full overflow-y-auto bg-slate-50/50 p-6 md:p-12">
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="max-w-7xl mx-auto space-y-8"
      >
        {/* Header Section */}
        <motion.div variants={item} className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="h-14 w-14 flex items-center justify-center shrink-0">
               <ProntoLogo className="w-full h-full" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Pronto</h1>
              <p className="text-slate-500 font-medium">Intelligent Response System</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 self-start md:self-center">
             {whatsappStatus !== 'connected' ? (
                <Link href="/dashboard/settings/whatsapp">
                  <button 
                    onClick={() => track('WhatsApp Connect Clicked')}
                    className="px-4 py-2 bg-green-600 rounded-full shadow-sm border border-green-700 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
                  >
                     Connect WhatsApp
                  </button>
                </Link>
             ) : (
                <button 
                  onClick={async () => {
                    if (!confirm('Are you sure you want to disconnect WhatsApp?')) return;
                    try {
                        track('WhatsApp Disconnect Clicked');
                        const res = await fetch('/api/whatsapp/session', { method: 'DELETE' });
                        if (res.ok) {
                            setWhatsappStatus('disconnected');
                            window.location.reload();
                        } else {
                            alert('Failed to disconnect');
                        }
                    } catch(e) {
                        alert('Error disconnecting');
                    }
                  }}
                  className="px-4 py-2 bg-white rounded-full shadow-sm border border-red-200 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                >
                    <Unplug size={16} />
                    Disconnect WhatsApp
                </button>
             )}
             
             <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-slate-200/60 backdrop-blur-sm">
                <div className="relative flex h-3 w-3 shrink-0">
                   <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${whatsappStatus === 'connected' ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
                   <span className={`relative inline-flex rounded-full h-3 w-3 ${whatsappStatus === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                 </div>
                <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">
                  {whatsappStatus === 'connected' ? 'System Online' : 'System Offline'}
                </span>
             </div>

             {/* User Profile Dropdown */}
             {user && (
               <div className="relative">
                 <button
                   onClick={() => setShowUserMenu(!showUserMenu)}
                   className="flex items-center gap-2 px-3 py-2 bg-white rounded-full shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors"
                 >
                   <div className="h-8 w-8 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                     {user.email?.charAt(0).toUpperCase() || 'U'}
                   </div>
                   <ChevronDown size={16} className="text-slate-400" />
                 </button>

                 {showUserMenu && (
                   <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50">
                     <div className="px-4 py-3 border-b border-slate-100">
                       <p className="text-sm font-semibold text-slate-900 truncate">{user.email}</p>
                       <p className="text-xs text-slate-500 mt-1">Signed in with {user.app_metadata.provider || 'email'}</p>
                     </div>
                     <button
                       onClick={handleLogout}
                       className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 rounded-xl transition-colors text-left mt-1"
                     >
                       <LogOut size={18} className="text-slate-400" />
                       <span className="text-sm font-medium text-slate-700">Sign out</span>
                     </button>
                   </div>
                 )}
               </div>
             )}
          </div>
        </motion.div>
        
        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <motion.div variants={item} whileHover={{ y: -4 }} className="h-full w-full flex flex-col">
            <Card className="flex-1 ring-0 shadow-lg shadow-slate-200/50 border border-slate-100 rounded-2xl p-6 bg-white overflow-hidden relative">
              <div className="flex items-center justify-between z-10 relative">
                <div>
                   <Text className="text-slate-500 font-medium">Total Leads</Text>
                   <Metric className="text-slate-900 text-4xl mt-2">{totalLeads}</Metric>
                </div>
                <div className="h-12 w-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 shrink-0">
                  <Users size={24} />
                </div>
              </div>
               <div className="mt-auto pt-4 flex items-center text-sm text-slate-400 font-medium whitespace-nowrap">
                  <span>Track your leads growth</span>
               </div>
            </Card>
          </motion.div>

          <motion.div variants={item} whileHover={{ y: -4 }} className="h-full w-full flex flex-col">
            <Card decoration="top" decorationColor="violet" className="flex-1 ring-0 shadow-lg shadow-slate-200/50 border border-slate-100 rounded-2xl p-6 bg-white relative">
              <div className="flex items-center justify-between">
                <div>
                   <Text className="text-slate-500 font-medium">Action Required</Text>
                   <Metric className="text-slate-900 text-4xl mt-2">{newLeads}</Metric>
                </div>
                 <div className="h-12 w-12 bg-violet-50 rounded-full flex items-center justify-center text-violet-600 shrink-0">
                  <AlertCircle size={24} />
                </div>
              </div>
              <div className="mt-auto pt-4 text-sm text-slate-400">
                Requires immediate follow-up
              </div>
            </Card>
          </motion.div>

          <motion.div variants={item} whileHover={{ y: -4 }} className="h-full w-full flex flex-col">
            <Card className="flex-1 ring-0 shadow-lg shadow-slate-200/50 border border-slate-100 rounded-2xl p-6 bg-gradient-to-br from-emerald-500/5 to-transparent relative">
               <div className="flex items-center justify-between">
                <div>
                   <Text className="text-slate-500 font-medium">Meetings Booked</Text>
                   <Metric className="text-slate-900 text-4xl mt-2">0</Metric>
                </div>
                 <div className="h-12 w-12 bg-emerald-100/50 rounded-full flex items-center justify-center text-emerald-600 shrink-0">
                  <CalendarCheck size={24} />
                </div>
              </div>
               <div className="mt-auto pt-4 flex items-center text-sm text-emerald-700 font-medium">
                 <span>No meetings scheduled</span>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Charts & Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 h-full w-full">
            <motion.div variants={item} className="h-full w-full">
              <Card className="h-full ring-0 shadow-xl shadow-slate-200/40 border border-slate-100 rounded-2xl p-6 bg-white z-0">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 shrink-0">
                    <Filter size={20} />
                  </div>
                  <div>
                    <Title className="text-slate-900 font-bold">Conversion Funnel</Title>
                    <Subtitle className="text-slate-500 text-sm">Real-time pipeline progression</Subtitle>
                  </div>
                </div>
                
                {/* Chart Container - Added explicit padding to prevent tooltip clipping if that was the issue */}
                <div className="mt-4 relative z-10" style={{ height: '300px' }}>
                  <BarChart
                    data={[
                        { stage: 'Leads', count: leads.length },
                        { stage: 'New', count: leads.filter(l => l.status === 'new').length },
                        { stage: 'Contacted', count: leads.filter(l => l.status === 'contacted').length },
                        { stage: 'Qualified', count: leads.filter(l => l.status === 'qualified').length },
                        { stage: 'Closed', count: leads.filter(l => l.status === 'closed').length },
                    ]}
                    index="stage"
                    categories={["count"]}
                    colors={["indigo"]}
                    yAxisWidth={48}
                    showAnimation={true}
                    showLegend={false}
                    className="h-full"
                  />
                </div>
              </Card>
            </motion.div>
          </div>
          
          <div className="h-full w-full">
            <motion.div variants={item} className="h-full w-full">
              <Card className="h-full ring-0 shadow-xl shadow-slate-200/40 border border-slate-100 rounded-2xl p-0 bg-white overflow-hidden flex flex-col min-h-[400px]">
                <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex items-center gap-2">
                   <div className="p-2 bg-blue-50 rounded-lg text-blue-600 shrink-0">
                    <Activity size={20} />
                  </div>
                  <div>
                    <Title className="text-slate-900 font-bold">Live Feed</Title>
                    <Subtitle className="text-slate-500 text-sm">Recent interactions</Subtitle>
                  </div>
                </div>
                
                <div className="p-4 space-y-2 flex-1 overflow-y-auto max-h-[300px]">
                  <AnimatePresence mode="popLayout" initial={false}>
                  {leads.slice(0, 10).map((lead) => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, x: -20, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                      key={lead.id} 
                      onClick={() => setSelectedLead(lead)}
                      className="group flex items-start gap-3 p-3 rounded-xl hover:bg-indigo-50/80 transition-colors cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-bold shrink-0 group-hover:bg-indigo-200 group-hover:text-indigo-700 transition-colors">
                         {lead.name ? lead.name.charAt(0).toUpperCase() : (lead.phone?.slice(-2) || 'L')}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-700 text-sm">
                          {lead.name || (() => {
                            try {
                              const raw = lead.real_phone || lead.phone || '';
                              const formattedRaw = raw.startsWith('+') ? raw : `+${raw}`;
                              const phoneNumber = parsePhoneNumber(formattedRaw);
                              return phoneNumber ? phoneNumber.formatInternational() : raw;
                            } catch (e) {
                              return lead.real_phone || lead.phone;
                            }
                          })()}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                            {lead.name && (() => {
                                try {
                                    const raw = lead.real_phone || lead.phone || '';
                                    const formattedRaw = raw.startsWith('+') ? raw : `+${raw}`;
                                    const phoneNumber = parsePhoneNumber(formattedRaw);
                                    return (phoneNumber ? phoneNumber.formatInternational() : raw) + ' • ';
                                } catch (e) { return ''; }
                            })()}
                            Status: {lead.status}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                            {new Date(lead.created_at).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})}
                        </p>
                      </div>
                      
                          <div className="flex flex-col items-end h-full justify-between ml-auto py-1 self-stretch">
                              <button 
                                 onClick={(e) => {
                                     e.stopPropagation();
                                     dismissLead(lead.id);
                                 }}
                                 className="p-1 text-slate-300 hover:text-slate-500 hover:bg-white/80 rounded-full transition-colors"
                                 title="Dismiss (UI only)"
                              >
                                 <X size={14} />
                              </button>
                          </div>
                    </motion.div>
                  ))}
                  </AnimatePresence>
                  {leads.length === 0 && (
                     <div className="text-center text-slate-400 py-10">No leads yet</div>
                  )}
                </div>
              </Card>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Chat Interface Modal */}
      <AnimatePresence>
        {selectedLead && (
          <ChatInterface 
            lead={selectedLead} 
            user={user} 
            onClose={() => setSelectedLead(null)} 
          />
        )}
      </AnimatePresence>
    </main>
  );
}
