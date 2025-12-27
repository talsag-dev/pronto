/**
 * Mixpanel Client
 *
 * Wrapper for Mixpanel analytics tracking.
 * Encapsulates event tracking and user properties.
 */

import Mixpanel from 'mixpanel';
import { env } from '@/lib/shared/config';
import { logger } from '@/lib/shared/utils';

export interface TrackEventParams {
  event: string;
  distinctId: string;
  properties?: Record<string, any>;
}

export interface UserProperties {
  $name?: string;
  $email?: string;
  $phone?: string;
  $created?: Date;
  [key: string]: any;
}

export class MixpanelClient {
  private readonly client: Mixpanel.Mixpanel | null;
  private readonly enabled: boolean;

  constructor(token?: string) {
    const mixpanelToken = token || env.MIXPANEL_TOKEN;

    if (mixpanelToken) {
      this.client = Mixpanel.init(mixpanelToken, {
        protocol: 'https',
      });
      this.enabled = true;
      logger.info('Mixpanel client initialized');
    } else {
      this.client = null;
      this.enabled = false;
      logger.warn('Mixpanel token not found - analytics disabled');
    }
  }

  /**
   * Track an event
   */
  track(params: TrackEventParams): void {
    if (!this.enabled || !this.client) {
      logger.debug('Mixpanel tracking skipped (disabled)', { event: params.event });
      return;
    }

    try {
      this.client.track(params.event, {
        distinct_id: params.distinctId,
        ...params.properties,
        timestamp: new Date().toISOString(),
      });

      logger.debug('Mixpanel event tracked', {
        event: params.event,
        distinctId: params.distinctId,
      });
    } catch (error) {
      // Don't throw - analytics failures shouldn't break app
      logger.error('Failed to track Mixpanel event', error, {
        event: params.event,
      });
    }
  }

  /**
   * Set user properties
   */
  setUserProperties(distinctId: string, properties: UserProperties): void {
    if (!this.enabled || !this.client) {
      return;
    }

    try {
      this.client.people.set(distinctId, properties);

      logger.debug('Mixpanel user properties set', { distinctId });
    } catch (error) {
      logger.error('Failed to set Mixpanel user properties', error, {
        distinctId,
      });
    }
  }

  /**
   * Increment a user property
   */
  incrementUserProperty(distinctId: string, property: string, by: number = 1): void {
    if (!this.enabled || !this.client) {
      return;
    }

    try {
      this.client.people.increment(distinctId, property, by);
    } catch (error) {
      logger.error('Failed to increment Mixpanel property', error, {
        distinctId,
        property,
      });
    }
  }

  /**
   * Track lead created event
   */
  trackLeadCreated(params: {
    organizationId: string;
    leadId: string;
    phone: string;
    source?: string;
  }): void {
    this.track({
      event: 'Lead Created',
      distinctId: params.organizationId,
      properties: {
        leadId: params.leadId,
        phone: params.phone,
        source: params.source || 'unknown',
      },
    });

    // Increment lead count for organization
    this.incrementUserProperty(params.organizationId, 'total_leads');
  }

  /**
   * Track message sent event
   */
  trackMessageSent(params: {
    organizationId: string;
    leadId: string;
    role: 'user' | 'assistant' | 'system';
    type: 'text' | 'audio';
    messageLength: number;
  }): void {
    this.track({
      event: 'Message Sent',
      distinctId: params.organizationId,
      properties: {
        leadId: params.leadId,
        role: params.role,
        type: params.type,
        messageLength: params.messageLength,
      },
    });

    // Increment message counters
    this.incrementUserProperty(params.organizationId, 'total_messages');
    if (params.role === 'assistant') {
      this.incrementUserProperty(params.organizationId, 'ai_messages');
    }
  }

  /**
   * Track WhatsApp connection event
   */
  trackWhatsAppConnected(params: {
    organizationId: string;
    phoneNumber: string;
    method: 'qr' | 'pairing';
  }): void {
    this.track({
      event: 'WhatsApp Connected',
      distinctId: params.organizationId,
      properties: {
        phoneNumber: params.phoneNumber,
        method: params.method,
      },
    });

    this.setUserProperties(params.organizationId, {
      whatsapp_connected: true,
      whatsapp_phone: params.phoneNumber,
      whatsapp_connected_at: new Date(),
    });
  }

  /**
   * Track AI status toggle event
   */
  trackAIToggle(params: {
    organizationId: string;
    leadId: string;
    status: 'active' | 'paused';
  }): void {
    this.track({
      event: 'AI Status Toggled',
      distinctId: params.organizationId,
      properties: {
        leadId: params.leadId,
        newStatus: params.status,
      },
    });
  }

  /**
   * Track conversation summary generated
   */
  trackSummaryGenerated(params: {
    organizationId: string;
    leadId: string;
    messageCount: number;
    summaryLength: number;
  }): void {
    this.track({
      event: 'Summary Generated',
      distinctId: params.organizationId,
      properties: {
        leadId: params.leadId,
        messageCount: params.messageCount,
        summaryLength: params.summaryLength,
      },
    });

    this.incrementUserProperty(params.organizationId, 'summaries_generated');
  }

  /**
   * Track organization created event
   */
  trackOrganizationCreated(params: {
    organizationId: string;
    userId: string;
    name: string;
    businessPhone: string;
  }): void {
    this.track({
      event: 'Organization Created',
      distinctId: params.organizationId,
      properties: {
        userId: params.userId,
        name: params.name,
        businessPhone: params.businessPhone,
      },
    });

    this.setUserProperties(params.organizationId, {
      $name: params.name,
      $phone: params.businessPhone,
      $created: new Date(),
      owner_id: params.userId,
    });
  }

  /**
   * Track user authentication event
   */
  trackUserAuth(params: {
    userId: string;
    email: string;
    event: 'login' | 'signup' | 'logout';
  }): void {
    this.track({
      event: params.event === 'signup' ? 'User Signed Up' : params.event === 'login' ? 'User Logged In' : 'User Logged Out',
      distinctId: params.userId,
      properties: {
        email: params.email,
      },
    });

    if (params.event === 'signup') {
      this.setUserProperties(params.userId, {
        $email: params.email,
        $created: new Date(),
      });
    }
  }

  /**
   * Track error event
   */
  trackError(params: {
    organizationId: string;
    error: string;
    context?: Record<string, any>;
  }): void {
    this.track({
      event: 'Error Occurred',
      distinctId: params.organizationId,
      properties: {
        error: params.error,
        ...params.context,
      },
    });
  }

  /**
   * Flush events (for graceful shutdown)
   */
  async flush(): Promise<void> {
    if (!this.enabled || !this.client) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.client!.track('Flush', {}, (err) => {
        if (err) {
          logger.error('Failed to flush Mixpanel events', err);
          reject(err);
        } else {
          logger.info('Mixpanel events flushed');
          resolve();
        }
      });
    });
  }
}

// Singleton instance
let mixpanelClientInstance: MixpanelClient | null = null;

/**
 * Get or create Mixpanel client instance
 */
export function mixpanelClient(): MixpanelClient {
  if (!mixpanelClientInstance) {
    mixpanelClientInstance = new MixpanelClient();
  }
  return mixpanelClientInstance;
}
