/**
 * Messages Repository
 *
 * Encapsulates all database operations for messages.
 * Handles conversation history, message creation, and analytics.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/shared/types';
import { BaseRepository } from './base.repository';
import { logger } from '@/lib/shared/utils';

type Message = Database['public']['Tables']['messages']['Row'];
type MessageInsert = Database['public']['Tables']['messages']['Insert'];

export interface CreateMessageParams {
  organizationId: string;
  leadId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  type?: 'text' | 'audio';
  whatsappMessageId?: string;
  tokenUsage?: number;
}

export interface MessageWithLead extends Message {
  lead?: {
    id: string;
    name: string | null;
    phone: string;
  };
}

export class MessagesRepository extends BaseRepository<'messages'> {
  constructor(client: SupabaseClient<Database>) {
    super(client, 'messages');
  }

  /**
   * Get message by ID
   */
  async getById(messageId: string): Promise<Message | null> {
    return (await this.findById(messageId)) as unknown as Message | null;
  }

  /**
   * Get conversation history for a lead
   */
  async getConversationHistory(
    leadId: string,
    options: {
      limit?: number;
      offset?: number;
      includeSystem?: boolean;
    } = {}
  ): Promise<Message[]> {
    const { limit = 100, offset = 0, includeSystem = true } = options;

    try {
      let query = this.client
        .from('messages')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: true });

      if (!includeSystem) {
        query = query.neq('role', 'system');
      }

      if (limit) {
        query = query.limit(limit);
      }

      if (offset) {
        query = query.range(offset, offset + limit - 1);
      }

      const { data, error } = await query;

      if (error) throw this.handleError(error, 'getConversationHistory');

      return data || [];
    } catch (error) {
      throw this.handleError(error, 'getConversationHistory');
    }
  }

  /**
   * Get recent conversations for an organization
   */
  async getRecentByOrganization(
    organizationId: string,
    options: {
      limit?: number;
      role?: 'user' | 'assistant' | 'system';
    } = {}
  ): Promise<MessageWithLead[]> {
    const { limit = 50, role } = options;

    try {
      let query = this.client
        .from('messages')
        .select(
          `
          *,
          lead:leads!inner (
            id,
            name,
            phone
          )
        `
        )
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (role) {
        query = query.eq('role', role);
      }

      const { data, error } = await query;

      if (error) throw this.handleError(error, 'getRecentByOrganization');

      return (data || []) as MessageWithLead[];
    } catch (error) {
      throw this.handleError(error, 'getRecentByOrganization');
    }
  }

  /**
   * Create a new message
   */
  async createMessage(params: CreateMessageParams): Promise<Message> {
    const messageData: MessageInsert = {
      organization_id: params.organizationId,
      lead_id: params.leadId,
      role: params.role,
      content: params.content,
      type: params.type || 'text',
      whatsapp_message_id: params.whatsappMessageId || null,
      token_usage: params.tokenUsage || null,
    };

    const message = await this.create(messageData);

    logger.info('Message created', {
      messageId: message.id,
      leadId: params.leadId,
      role: params.role,
      type: params.type,
    });

    return message;
  }

  /**
   * Get last message for a lead
   */
  async getLastMessage(leadId: string): Promise<Message | null> {
    try {
      const { data, error } = await this.client
        .from('messages')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw this.handleError(error, 'getLastMessage');
      }

      return data;
    } catch (error) {
      throw this.handleError(error, 'getLastMessage');
    }
  }

  /**
   * Count messages for a lead
   */
  async countByLead(leadId: string): Promise<number> {
    return this.count({ lead_id: leadId });
  }

  /**
   * Count messages by role for analytics
   */
  async countByRole(
    organizationId: string,
    dateFrom?: Date
  ): Promise<Record<string, number>> {
    try {
      let query = this.client
        .from('messages')
        .select('role')
        .eq('organization_id', organizationId);

      if (dateFrom) {
        query = query.gte('created_at', dateFrom.toISOString());
      }

      const { data, error } = await query;

      if (error) throw this.handleError(error, 'countByRole');

      const counts: Record<string, number> = {
        user: 0,
        assistant: 0,
        system: 0,
      };

      (data as { role: string }[] | null)?.forEach((msg) => {
        if (msg.role in counts) {
          counts[msg.role]++;
        }
      });

      return counts;
    } catch (error) {
      throw this.handleError(error, 'countByRole');
    }
  }

  /**
   * Get total token usage for an organization
   */
  async getTotalTokenUsage(
    organizationId: string,
    dateFrom?: Date
  ): Promise<number> {
    try {
      let query = this.client
        .from('messages')
        .select('token_usage')
        .eq('organization_id', organizationId)
        .not('token_usage', 'is', null);

      if (dateFrom) {
        query = query.gte('created_at', dateFrom.toISOString());
      }

      const { data, error } = await query;

      if (error) throw this.handleError(error, 'getTotalTokenUsage');

      return (
        (data as { token_usage: number | null }[] | null)?.reduce(
          (sum, msg) => sum + (msg.token_usage || 0),
          0
        ) || 0
      );
    } catch (error) {
      throw this.handleError(error, 'getTotalTokenUsage');
    }
  }

  /**
   * Delete all messages for a lead
   */
  async deleteByLead(leadId: string): Promise<void> {
    try {
      const { error } = await this.client
        .from('messages')
        .delete()
        .eq('lead_id', leadId);

      if (error) throw this.handleError(error, 'deleteByLead');

      logger.info('Deleted all messages for lead', { leadId });
    } catch (error) {
      throw this.handleError(error, 'deleteByLead');
    }
  }

  /**
   * Find message by WhatsApp message ID
   */
  async findByWhatsAppId(whatsappMessageId: string): Promise<Message | null> {
    try {
      const { data, error } = await this.client
        .from('messages')
        .select('*')
        .eq('whatsapp_message_id', whatsappMessageId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw this.handleError(error, 'findByWhatsAppId');
      }

      return data;
    } catch (error) {
      throw this.handleError(error, 'findByWhatsAppId');
    }
  }
}
