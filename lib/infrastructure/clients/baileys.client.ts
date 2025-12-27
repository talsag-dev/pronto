/**
 * Baileys WhatsApp Client
 *
 * Wrapper for WhatsApp Worker service communication.
 * Encapsulates all HTTP calls to the worker service.
 */

import { env } from '@/lib/shared/config';
import { logger } from '@/lib/shared/utils';
import { ExternalServiceError } from '@/lib/shared/utils/errors';

export interface SendMessageParams {
  to: string;
  message: string;
  orgId: string;
}

export interface SendMessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface InitSessionParams {
  orgId: string;
  forceNew?: boolean;
}

export interface SessionStatusResponse {
  status: 'connected' | 'disconnected' | 'connecting';
  qr?: string;
  error?: string;
}

export interface PairingCodeParams {
  orgId: string;
  phoneNumber: string;
}

export interface PairingCodeResponse {
  code: string;
  expiresAt: string;
}

export class BaileysClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || env.WHATSAPP_WORKER_URL;
  }

  /**
   * Send WhatsApp message
   */
  async sendMessage(params: SendMessageParams): Promise<SendMessageResponse> {
    try {
      logger.info('Sending WhatsApp message', {
        orgId: params.orgId,
        to: params.to,
      });

      const response = await fetch(`${this.baseUrl}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: params.to,
          message: params.message,
          orgId: params.orgId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new ExternalServiceError(
          'WhatsApp',
          `Failed to send message: ${data.error || response.statusText}`,
          { status: response.status, data }
        );
      }

      logger.info('WhatsApp message sent', {
        orgId: params.orgId,
        messageId: data.messageId,
      });

      return data;
    } catch (error) {
      logger.error('Failed to send WhatsApp message', error, {
        orgId: params.orgId,
        to: params.to,
      });

      if (error instanceof ExternalServiceError) {
        throw error;
      }

      throw new ExternalServiceError(
        'WhatsApp',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Initialize WhatsApp session
   */
  async initSession(params: InitSessionParams): Promise<SessionStatusResponse> {
    try {
      logger.info('Initializing WhatsApp session', { orgId: params.orgId });

      const response = await fetch(`${this.baseUrl}/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orgId: params.orgId,
          forceNew: params.forceNew || false,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new ExternalServiceError(
          'WhatsApp',
          `Failed to init session: ${data.error || response.statusText}`,
          { status: response.status, data }
        );
      }

      return data;
    } catch (error) {
      logger.error('Failed to init WhatsApp session', error, {
        orgId: params.orgId,
      });

      if (error instanceof ExternalServiceError) {
        throw error;
      }

      throw new ExternalServiceError(
        'WhatsApp',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Get session status
   */
  async getSessionStatus(orgId: string): Promise<SessionStatusResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/status?orgId=${orgId}`, {
        method: 'GET',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new ExternalServiceError(
          'WhatsApp',
          `Failed to get session status: ${data.error || response.statusText}`,
          { status: response.status, data }
        );
      }

      return data;
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw error;
      }

      throw new ExternalServiceError(
        'WhatsApp',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Request pairing code for phone number
   */
  async requestPairingCode(
    params: PairingCodeParams
  ): Promise<PairingCodeResponse> {
    try {
      logger.info('Requesting pairing code', {
        orgId: params.orgId,
        phone: params.phoneNumber,
      });

      const response = await fetch(`${this.baseUrl}/pairing-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orgId: params.orgId,
          phoneNumber: params.phoneNumber,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new ExternalServiceError(
          'WhatsApp',
          `Failed to get pairing code: ${data.error || response.statusText}`,
          { status: response.status, data }
        );
      }

      return data;
    } catch (error) {
      logger.error('Failed to request pairing code', error, {
        orgId: params.orgId,
      });

      if (error instanceof ExternalServiceError) {
        throw error;
      }

      throw new ExternalServiceError(
        'WhatsApp',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Disconnect session
   */
  async disconnectSession(orgId: string): Promise<void> {
    try {
      logger.info('Disconnecting WhatsApp session', { orgId });

      const response = await fetch(`${this.baseUrl}/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orgId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new ExternalServiceError(
          'WhatsApp',
          `Failed to disconnect: ${data.error || response.statusText}`,
          { status: response.status, data }
        );
      }

      logger.info('WhatsApp session disconnected', { orgId });
    } catch (error) {
      logger.error('Failed to disconnect WhatsApp session', error, { orgId });

      if (error instanceof ExternalServiceError) {
        throw error;
      }

      throw new ExternalServiceError(
        'WhatsApp',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Get QR code for session
   */
  async getQRCode(orgId: string): Promise<string | null> {
    try {
      const status = await this.getSessionStatus(orgId);
      return status.qr || null;
    } catch (error) {
      logger.error('Failed to get QR code', error, { orgId });
      return null;
    }
  }

  /**
   * Check if session is connected
   */
  async isConnected(orgId: string): Promise<boolean> {
    try {
      const status = await this.getSessionStatus(orgId);
      return status.status === 'connected';
    } catch (error) {
      return false;
    }
  }
}

// Singleton instance
let baileysClientInstance: BaileysClient | null = null;

/**
 * Get or create Baileys client instance
 */
export function baileysClient(): BaileysClient {
  if (!baileysClientInstance) {
    baileysClientInstance = new BaileysClient();
  }
  return baileysClientInstance;
}
