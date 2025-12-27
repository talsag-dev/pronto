'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Bot, User, PauseCircle, PlayCircle, Loader2 } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { formatPhoneNumber } from '../lib/shared/utils/phone';

interface ChatInterfaceProps {
  lead: any;
  user: any;
  onClose: () => void;
}

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ChatInterface({ lead, user, onClose }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [aiStatus, setAiStatus] = useState(lead.ai_status || 'active');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch messages
  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: true });
      
      if (data) setMessages(data);
      setLoading(false);
    };

    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`chat-${lead.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `lead_id=eq.${lead.id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lead.id]);

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          orgId: lead.organization_id,
          message: newMessage 
        }),
      });

      if (!res.ok) throw new Error('Failed to send');
      
      setNewMessage('');
    } catch (error) {
      console.error(error);
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const toggleAi = async () => {
    const newStatus = aiStatus === 'active' ? 'paused' : 'active';
    try {
      // Optimistic update
      setAiStatus(newStatus);
      
      const res = await fetch('/api/leads/toggle-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, status: newStatus }),
      });

      if (!res.ok) {
        setAiStatus(aiStatus); // Revert
        throw new Error('Failed to toggle AI');
      }
    } catch (error) {
      console.error(error);
      alert('Failed to update AI status');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm"
    >
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                 {lead.name ? lead.name.charAt(0).toUpperCase() : (lead.phone?.slice(-2) || '?')}
             </div>
             <div>
               <h3 className="font-bold text-gray-900">
                  {lead.name || formatPhoneNumber(lead.real_phone || lead.phone)}
               </h3>
               <div className="flex flex-col">
                 {lead.name && (
                   <p className="text-xs text-gray-500">
                     {formatPhoneNumber(lead.real_phone || lead.phone)}
                   </p>
                 )}
                 <p className="text-xs text-gray-400 flex items-center gap-1">
                   Status: {lead.status}
                 </p>
               </div>
             </div>
          </div>
          
          <div className="flex items-center gap-2">
             <button
               onClick={toggleAi}
               className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                 aiStatus === 'active' 
                   ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                   : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
               }`}
             >
                {aiStatus === 'active' ? (
                  <>
                    <Bot size={14} /> AI Active
                  </>
                ) : (
                  <>
                    <PauseCircle size={14} /> AI Paused
                  </>
                )}
             </button>
             <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
               <X size={20} />
             </button>
          </div>
        </div>

        {/* Messages */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50"
        >
          {loading ? (
             <div className="flex justify-center py-10">
               <Loader2 className="animate-spin text-gray-400" />
             </div>
          ) : messages.length === 0 ? (
             <div className="text-center text-gray-400 py-10 text-sm">
                No messages yet.
             </div>
          ) : (
            (() => {
              // Deduplicate messages by whatsapp_message_id if present
              const seen = new Set();
              const uniqueMessages = messages.filter(m => {
                if (!m.whatsapp_message_id) return true;
                if (seen.has(m.whatsapp_message_id)) return false;
                seen.add(m.whatsapp_message_id);
                return true;
              });

              return uniqueMessages.map((m) => {
                const isUser = m.role === 'user';
                
                return (
                   <div 
                     key={m.id} 
                     className={`flex w-full ${isUser ? 'justify-start' : 'justify-end'}`}
                   >
                     <div 
                       className={`max-w-[70%] text-sm p-3 rounded-2xl shadow-sm ${
                         isUser 
                           ? 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm' 
                           : 'bg-indigo-600 text-white rounded-br-sm'
                       }`}
                     >
                       {m.content}
                     </div>
                   </div>
                );
              });
            })()
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-100 shrink-0">
          {aiStatus === 'active' && (
             <div className="mb-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg flex items-center gap-2">
                <Bot size={14} />
                <span>AI is currently active. Pause it to take control.</span>
             </div>
          )}
          <div className="flex gap-2">
             <input
               type="text"
               value={newMessage}
               onChange={(e) => setNewMessage(e.target.value)}
               placeholder={aiStatus === 'active' ? "You can still reply manually..." : "Type your message..."}
               className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
             />
             <button
               type="submit"
               disabled={!newMessage.trim() || sending}
               className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white p-2 rounded-xl transition-colors flex items-center justify-center min-w-[44px]"
             >
               {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
             </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}
