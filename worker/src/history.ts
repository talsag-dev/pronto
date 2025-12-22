import { WAMessage } from '@whiskeysockets/baileys';
import { supabaseAdmin } from './supabase';
import NodeCache from 'node-cache';

// Cache lead IDs to avoid constant DB lookups during batch processing
const leadCache = new NodeCache({ stdTTL: 60 * 60, useClones: false });

export class HistoryManager {
    private queue: { orgId: string, message: WAMessage }[] = [];
    private processing = false;
    private batchSize = 100;
    private flushInterval = 2000;
    private timer: NodeJS.Timeout | null = null;

    constructor() {
        this.startFlushTimer();
    }

    private startFlushTimer() {
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => this.flush(), this.flushInterval);
    }

    public async queueMessages(orgId: string, messages: WAMessage[]) {
        for (const msg of messages) {
            // Only process valid messages (not protocol messages) if possible
            // But usually we just want text/media
            if (msg.message) {
                this.queue.push({ orgId, message: msg });
            }
        }

        if (this.queue.length >= this.batchSize) {
            await this.flush();
        }
    }

    private async flush() {
        if (this.processing || this.queue.length === 0) return;
        this.processing = true;

        try {
            const batch = this.queue.splice(0, this.batchSize);
            const messagesToInsert = [];
            
            // We need to group by Org to minimize DB lookups if we are processing multiple orgs mixed (unlikely but possible)
            // But wait, leads are specific to Orgs.
            
            for (const item of batch) {
                const { orgId, message } = item;
                const jid = message.key.remoteJid;
                if (!jid) continue;

                const isFromMe = message.key.fromMe || false;
                const phone = jid.split('@')[0];
                const leadCacheKey = `${orgId}:${phone}`;
                
                let leadId = leadCache.get<string>(leadCacheKey);

                if (!leadId) {
                    const newId = await this.getOrCreateLead(orgId, phone, isFromMe);
                    if (newId) {
                        leadId = newId;
                        leadCache.set(leadCacheKey, leadId);
                    }
                }

                if (leadId) {
                    const messageText = message.message?.conversation || 
                                      message.message?.extendedTextMessage?.text || 
                                      message.message?.imageMessage?.caption ||
                                      '';

                    if (messageText) {
                        // Calculate timestamps
                        // message.messageTimestamp can be a Long or number.
                        // Baileys often returns unix seconds.
                        const ts = typeof message.messageTimestamp === 'number' 
                            ? message.messageTimestamp 
                            : (message.messageTimestamp as any)?.low || Math.floor(Date.now() / 1000);
                        
                        const createdAt = new Date(ts * 1000).toISOString();

                        messagesToInsert.push({
                            organization_id: orgId,
                            lead_id: leadId,
                            role: isFromMe ? 'assistant' : 'user',
                            content: messageText,
                            type: 'text',
                            created_at: createdAt
                        });
                    }
                }
            }

            if (messagesToInsert.length > 0) {
                // Use upsert to avoid duplicates if we accidentally re-sync
                // We need a unique constraint on (lead_id, created_at, content) or similar to truly robustly dedup
                // But Supabase 'messages' table might not have one. 
                // We will just insert for now. If user re-syncs, they might get dupes. 
                // Ideally we'd have a 'whatsapp_id' column.
                // Assuming standard insert for now.
                const { error } = await supabaseAdmin.from('messages').insert(messagesToInsert);
                if (error) {
                    console.error('[HISTORY] Batch insert error:', error);
                } else {
                    console.log(`[HISTORY] Inserted ${messagesToInsert.length} historical messages`);
                }
            }

        } catch (error) {
            console.error('[HISTORY] Flush error:', error);
        } finally {
            this.processing = false;
        }
    }

    private async getOrCreateLead(orgId: string, phone: string, isFromMe: boolean): Promise<string | null> {
        try {
            // Try fetch
            const { data: existing } = await supabaseAdmin
                .from('leads')
                .select('id')
                .eq('organization_id', orgId)
                .eq('phone', phone)
                .single();
            
            if (existing) return existing.id;

            // Create
            const { data: newLead } = await supabaseAdmin
                .from('leads')
                .insert({
                    organization_id: orgId,
                    phone: phone,
                    status: 'new',
                    ai_status: isFromMe ? 'paused' : 'active'
                })
                .select('id')
                .single();
            
            return newLead?.id || null;
        } catch (e) {
            console.error(`[HISTORY] Failed to resolve lead ${phone}:`, e);
            return null;
        }
    }
}

export const historyManager = new HistoryManager();
