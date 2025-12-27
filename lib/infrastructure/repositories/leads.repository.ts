/**
 * Leads Repository
 *
 * Encapsulates all database operations for leads.
 * Eliminates direct Supabase queries from components and API routes.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/shared/types';
import { BaseRepository } from './base.repository';
import { NotFoundError, logger } from '@/lib/shared/utils';
import { formatPhoneNumber } from '@/lib/shared/utils/phone';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadInsert = Database['public']['Tables']['leads']['Insert'];
type LeadUpdate = Database['public']['Tables']['leads']['Update'];

export interface LeadWithDisplay extends Lead {
  formattedPhone: string;
  phoneInitials: string;
}

export interface CreateLeadParams {
  organizationId: string;
  phone: string;
  name?: string;
  languagePreference?: 'he' | 'en';
  metadata?: Record<string, unknown>;
}

export interface UpdateLeadParams {
  name?: string;
  status?: 'new' | 'contacted' | 'qualified' | 'closed';
  conversationStage?: string;
  aiStatus?: 'active' | 'paused';
  languagePreference?: 'he' | 'en';
  metadata?: Record<string, unknown>;
  lastMessageAt?: string;
}

export class LeadsRepository extends BaseRepository<'leads'> {
  constructor(client: SupabaseClient<Database>) {
    super(client, 'leads');
  }

  /**
   * Get lead by ID with formatted display data
   */
  async getById(leadId: string): Promise<LeadWithDisplay | null> {
    const lead = (await this.findById(leadId)) as unknown as Lead | null;
    if (!lead) return null;

    return this.addDisplayData(lead);
  }

  /**
   * Get lead by ID or throw NotFoundError
   */
  async getByIdOrFail(leadId: string): Promise<LeadWithDisplay> {
    const lead = await this.getById(leadId);
    if (!lead) {
      throw new NotFoundError('Lead', { leadId });
    }
    return lead;
  }

  /**
   * Get all leads for an organization
   */
  async getByOrganization(
    organizationId: string,
    options: {
      status?: Lead['status'];
      aiStatus?: Lead['ai_status'];
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<LeadWithDisplay[]> {
    const filters: Partial<Lead> = {
      organization_id: organizationId,
    };

    if (options.status) filters.status = options.status;
    if (options.aiStatus) filters.ai_status = options.aiStatus;

    const leads = (await this.findMany(filters, '*', {
      orderBy: { column: 'last_message_at', ascending: false },
      limit: options.limit,
      offset: options.offset,
    })) as unknown as Lead[];

    return leads.map((lead) => this.addDisplayData(lead));
  }

  /**
   * Find lead by phone number and organization
   */
  async findByPhone(
    organizationId: string,
    phone: string
  ): Promise<LeadWithDisplay | null> {
    try {
      const { data, error } = await this.client
        .from('leads')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('phone', phone)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw this.handleError(error, 'findByPhone');
      }

      return this.addDisplayData(data);
    } catch (error) {
      throw this.handleError(error, 'findByPhone');
    }
  }

  /**
   * Create a new lead
   */
  async createLead(params: CreateLeadParams): Promise<LeadWithDisplay> {
    const leadData: LeadInsert = {
      organization_id: params.organizationId,
      phone: params.phone,
      name: params.name || null,
      language_preference: params.languagePreference || 'he',
      metadata: (params.metadata || {}) as Json,
      status: 'new',
      ai_status: 'active',
      conversation_stage: null,
      last_message_at: new Date().toISOString(),
      real_phone: null,
    };

    const lead = (await this.create(leadData)) as unknown as Lead;
    logger.info('Lead created', {
      leadId: lead.id,
      orgId: params.organizationId,
      phone: params.phone,
    });

    return this.addDisplayData(lead);
  }

  /**
   * Update lead
   */
  async updateLead(
    leadId: string,
    params: UpdateLeadParams
  ): Promise<LeadWithDisplay> {
    const updateData: LeadUpdate = {};

    if (params.name !== undefined) updateData.name = params.name;
    if (params.status) updateData.status = params.status;
    if (params.conversationStage !== undefined)
      updateData.conversation_stage = params.conversationStage;
    if (params.aiStatus) updateData.ai_status = params.aiStatus;
    if (params.languagePreference)
      updateData.language_preference = params.languagePreference;
    if (params.metadata) updateData.metadata = params.metadata as Json;
    if (params.lastMessageAt) updateData.last_message_at = params.lastMessageAt;

    const lead = (await this.update(leadId, updateData)) as unknown as Lead;
    return this.addDisplayData(lead);
  }

  /**
   * Toggle AI status for a lead
   */
  async toggleAI(
    leadId: string,
    status: 'active' | 'paused'
  ): Promise<LeadWithDisplay> {
    return this.updateLead(leadId, { aiStatus: status });
  }

  /**
   * Update last message timestamp
   */
  async updateLastMessageAt(leadId: string): Promise<void> {
    await this.update(leadId, {
      last_message_at: new Date().toISOString(),
    });
  }

  /**
   * Count leads by status for an organization
   */
  async countByStatus(organizationId: string): Promise<Record<string, number>> {
    try {
      const { data, error } = await this.client
        .from('leads')
        .select('status')
        .eq('organization_id', organizationId);

      if (error) throw this.handleError(error, 'countByStatus');

      const counts: Record<string, number> = {
        new: 0,
        contacted: 0,
        qualified: 0,
        closed: 0,
      };

      (data as { status: string }[] | null)?.forEach((lead) => {
        if (lead.status in counts) {
          counts[lead.status]++;
        }
      });

      return counts;
    } catch (error) {
      throw this.handleError(error, 'countByStatus');
    }
  }

  /**
   * Get leads that need AI nudge (haven't messaged in X hours)
   */
  async getLeadsForNudge(
    organizationId: string,
    hoursSinceLastMessage: number = 24
  ): Promise<LeadWithDisplay[]> {
    try {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - hoursSinceLastMessage);

      const { data, error } = await this.client
        .from('leads')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('ai_status', 'active')
        .neq('status', 'closed')
        .lt('last_message_at', cutoffTime.toISOString())
        .order('last_message_at', { ascending: true })
        .limit(50);

      if (error) throw this.handleError(error, 'getLeadsForNudge');

      return (data || []).map((lead) => this.addDisplayData(lead));
    } catch (error) {
      throw this.handleError(error, 'getLeadsForNudge');
    }
  }

  /**
   * Delete a lead
   */
  async deleteLead(leadId: string): Promise<void> {
    await this.delete(leadId);
  }

  /**
   * Add formatted display data to lead
   */
  private addDisplayData(lead: Lead): LeadWithDisplay {
    return {
      ...lead,
      formattedPhone: formatPhoneNumber(lead.phone),
      phoneInitials: lead.phone?.slice(-2) || '??',
    };
  }
}
