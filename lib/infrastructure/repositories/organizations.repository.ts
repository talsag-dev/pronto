/**
 * Organizations Repository
 *
 * Encapsulates all database operations for organizations.
 * Handles org creation, integrations, and configuration management.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/shared/types';
import { BaseRepository } from './base.repository';
import { NotFoundError, logger } from '@/lib/shared/utils';

type Organization = Database['public']['Tables']['organizations']['Row'];
type OrganizationInsert = Database['public']['Tables']['organizations']['Insert'];
type OrganizationUpdate = Database['public']['Tables']['organizations']['Update'];

export interface CreateOrganizationParams {
  name: string;
  businessPhone: string;
  ownerId?: string;
  config?: Record<string, unknown>;
  integrations?: Record<string, unknown>;
}

export interface UpdateOrganizationParams {
  name?: string;
  businessPhone?: string;
  config?: Record<string, unknown>;
  integrations?: Record<string, unknown>;
}

export interface WhatsAppIntegration {
  accessToken?: string;
  phoneId?: string;
  businessId?: string;
  phoneNumber?: string;
  status?: string;
}

export interface CalIntegration {
  accessToken?: string;
  refreshToken?: string;
  userId?: string;
}

export class OrganizationsRepository extends BaseRepository<'organizations'> {
  constructor(client: SupabaseClient<Database>) {
    super(client, 'organizations');
  }

  /**
   * Get organization by ID
   */
  async getById(orgId: string): Promise<Organization | null> {
    return (await this.findById(orgId)) as unknown as Organization | null;
  }

  /**
   * Get organization by ID or throw NotFoundError
   */
  async getByIdOrFail(orgId: string): Promise<Organization> {
    const org = await this.getById(orgId);
    if (!org) {
      throw new NotFoundError('Organization', { orgId });
    }
    return org;
  }

  /**
   * Get organization by owner ID
   */
  async getByOwnerId(ownerId: string): Promise<Organization | null> {
    try {
      const { data, error } = await this.client
        .from('organizations')
        .select('*')
        .eq('owner_id', ownerId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw this.handleError(error, 'getByOwnerId');
      }

      return data;
    } catch (error) {
      throw this.handleError(error, 'getByOwnerId');
    }
  }

  /**
   * Get organization by business phone
   */
  async getByBusinessPhone(phone: string): Promise<Organization | null> {
    try {
      const { data, error } = await this.client
        .from('organizations')
        .select('*')
        .eq('business_phone', phone)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw this.handleError(error, 'getByBusinessPhone');
      }

      return data;
    } catch (error) {
      throw this.handleError(error, 'getByBusinessPhone');
    }
  }

  /**
   * Create a new organization
   */
  async createOrganization(
    params: CreateOrganizationParams
  ): Promise<Organization> {
    const orgData: OrganizationInsert = {
      name: params.name,
      business_phone: params.businessPhone,
      owner_id: params.ownerId || null,
      config: (params.config || {}) as Json,
      integrations: (params.integrations || {}) as Json,
      cal_access_token: null,
      cal_refresh_token: null,
      cal_user_id: null,
      whatsapp_status: null,
    };

    const org = (await this.create(orgData)) as unknown as Organization;

    logger.info('Organization created', {
      orgId: org.id,
      name: params.name,
      ownerId: params.ownerId,
    });

    return org;
  }

  /**
   * Update organization
   */
  async updateOrganization(
    orgId: string,
    params: UpdateOrganizationParams
  ): Promise<Organization> {
    const updateData: OrganizationUpdate = {};

    if (params.name) updateData.name = params.name;
    if (params.businessPhone) updateData.business_phone = params.businessPhone;
    if (params.config) updateData.config = params.config as Json;
    if (params.integrations) updateData.integrations = params.integrations as Json;

    return (await this.update(orgId, updateData)) as unknown as Organization;
  }

  /**
   * Update WhatsApp integration
   */
  async updateWhatsAppIntegration(
    orgId: string,
    whatsapp: WhatsAppIntegration
  ): Promise<Organization> {
    const updateData: OrganizationUpdate = {};

    if (whatsapp.status !== undefined)
      updateData.whatsapp_status = whatsapp.status;

    const org = (await this.update(orgId, updateData)) as unknown as Organization;

    logger.info('WhatsApp integration updated', {
      orgId,
      status: whatsapp.status,
    });

    return org;
  }

  /**
   * Update Cal.com integration
   */
  async updateCalIntegration(
    orgId: string,
    cal: CalIntegration
  ): Promise<Organization> {
    const updateData: OrganizationUpdate = {};

    if (cal.accessToken !== undefined)
      updateData.cal_access_token = cal.accessToken;
    if (cal.refreshToken !== undefined)
      updateData.cal_refresh_token = cal.refreshToken;
    if (cal.userId !== undefined) updateData.cal_user_id = cal.userId;

    const org = (await this.update(orgId, updateData)) as unknown as Organization;

    logger.info('Cal.com integration updated', {
      orgId,
      userId: cal.userId,
    });

    return org;
  }

  /**
   * Check if WhatsApp is connected
   */
  async isWhatsAppConnected(orgId: string): Promise<boolean> {
    const org = await this.getById(orgId);
    if (!org) return false;

    return org.whatsapp_status === 'connected';
  }

  /**
   * Check if Cal.com is connected
   */
  async isCalConnected(orgId: string): Promise<boolean> {
    const org = await this.getById(orgId);
    if (!org) return false;

    return !!(org.cal_access_token && org.cal_user_id);
  }

  /**
   * Get organization config
   */
  async getConfig(orgId: string): Promise<Record<string, unknown>> {
    const org = await this.getByIdOrFail(orgId);
    return (org.config as Record<string, unknown>) || {};
  }

  /**
   * Update organization config (merge with existing)
   */
  async updateConfig(
    orgId: string,
    configUpdates: Record<string, unknown>
  ): Promise<Organization> {
    const org = await this.getByIdOrFail(orgId);
    const updatedConfig = {
      ...((org.config as Record<string, unknown>) || {}),
      ...configUpdates,
    };

    return (await this.update(orgId, { config: updatedConfig as Json })) as Organization;
  }

  /**
   * Get organization integrations
   */
  async getIntegrations(orgId: string): Promise<Record<string, unknown>> {
    const org = await this.getByIdOrFail(orgId);
    return (org.integrations as Record<string, unknown>) || {};
  }

  /**
   * Update organization integrations (merge with existing)
   */
  async updateIntegrations(
    orgId: string,
    integrationUpdates: Record<string, unknown>
  ): Promise<Organization> {
    const org = await this.getByIdOrFail(orgId);
    const updatedIntegrations = {
      ...((org.integrations as Record<string, unknown>) || {}),
      ...integrationUpdates,
    };

    return (await this.update(orgId, { integrations: updatedIntegrations as Json })) as Organization;
  }

  /**
   * Delete organization
   */
  async deleteOrganization(orgId: string): Promise<void> {
    await this.delete(orgId);
  }

  /**
   * List all organizations (admin only)
   */
  async listAll(options: { limit?: number; offset?: number } = {}): Promise<
    Organization[]
  > {
    return (await this.findMany({}, '*', {
      orderBy: { column: 'created_at', ascending: false },
      limit: options.limit,
      offset: options.offset,
    })) as unknown as Organization[];
  }
}
