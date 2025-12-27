/**
 * API type definitions
 *
 * This module defines types for API requests and responses.
 * These types ensure type safety across the API boundary.
 */

import type { Lead, Message, Organization } from './domain.types';

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  details?: unknown;
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// ============================================================================
// Message API Types
// ============================================================================

export interface SendMessageRequest {
  leadId: string;
  orgId: string;
  message: string;
}

export interface SendMessageResponse extends ApiResponse {
  data?: {
    messageId: string;
    whatsappMessageId?: string;
  };
}

export interface GetMessagesRequest {
  leadId: string;
  page?: number;
  pageSize?: number;
}

export interface GetMessagesResponse extends PaginatedResponse<Message> {}

// ============================================================================
// Lead API Types
// ============================================================================

export interface CreateLeadRequest {
  phone: string;
  name?: string;
  organizationId: string;
  language_preference?: 'he' | 'en';
  metadata?: Record<string, unknown>;
}

export interface CreateLeadResponse extends ApiResponse {
  data?: {
    lead: Lead;
  };
}

export interface UpdateLeadRequest {
  leadId: string;
  name?: string;
  status?: 'new' | 'contacted' | 'qualified' | 'closed';
  conversation_stage?: string;
  metadata?: Record<string, unknown>;
  language_preference?: 'he' | 'en';
}

export interface UpdateLeadResponse extends ApiResponse {
  data?: {
    lead: Lead;
  };
}

export interface ToggleAIRequest {
  leadId: string;
  status: 'active' | 'paused';
}

export interface ToggleAIResponse extends ApiResponse {}

export interface GetLeadsRequest {
  organizationId: string;
  status?: 'new' | 'contacted' | 'qualified' | 'closed';
  page?: number;
  pageSize?: number;
}

export interface GetLeadsResponse extends PaginatedResponse<Lead> {}

// ============================================================================
// Organization API Types
// ============================================================================

export interface CreateOrganizationRequest {
  name: string;
  business_phone: string;
  config?: Record<string, unknown>;
  integrations?: Record<string, unknown>;
}

export interface CreateOrganizationResponse extends ApiResponse {
  data?: {
    organization: Organization;
  };
}

export interface GetOrganizationRequest {
  organizationId: string;
}

export interface GetOrganizationResponse extends ApiResponse {
  data?: {
    organization: Organization;
  };
}

// ============================================================================
// WhatsApp API Types
// ============================================================================

export interface WhatsAppSessionInitRequest {
  orgId: string;
  forceNew?: boolean;
}

export interface WhatsAppSessionInitResponse extends ApiResponse {
  data?: {
    status: 'connected' | 'qr' | 'disconnected';
    qr?: string;
  };
}

export interface WhatsAppPairingCodeRequest {
  orgId: string;
  phoneNumber: string;
}

export interface WhatsAppPairingCodeResponse extends ApiResponse {
  data?: {
    code: string;
  };
}

export interface WhatsAppSendMessageRequest {
  orgId: string;
  to: string;
  message: string;
}

export interface WhatsAppSendMessageResponse extends ApiResponse {
  data?: {
    result: {
      key: {
        id: string;
        remoteJid: string;
        fromMe: boolean;
      };
    };
  };
}

export interface WhatsAppSessionStatusRequest {
  orgId: string;
}

export interface WhatsAppSessionStatusResponse extends ApiResponse {
  data?: {
    status: 'connected' | 'qr' | 'disconnected' | 'not_started';
    qr?: string;
    whatsapp_status?: string;
  };
}

export interface WhatsAppDisconnectRequest {
  orgId: string;
}

export interface WhatsAppDisconnectResponse extends ApiResponse {}

// ============================================================================
// Webhook API Types
// ============================================================================

export interface WebhookPayloadRequest {
  orgId: string;
  message: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
    message: Record<string, unknown>;
  };
}

export interface WebhookPayloadResponse extends ApiResponse {}

// ============================================================================
// Auth API Types
// ============================================================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse extends ApiResponse {
  data?: {
    user: {
      id: string;
      email: string;
    };
    session: {
      access_token: string;
      refresh_token: string;
    };
  };
}

export interface SignupRequest {
  email: string;
  password: string;
  name?: string;
}

export interface SignupResponse extends ApiResponse {
  data?: {
    user: {
      id: string;
      email: string;
    };
  };
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * API error response structure
 */
export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
  statusCode: number;
}

/**
 * SSE (Server-Sent Events) message structure
 */
export interface SSEMessage<T = unknown> {
  event?: string;
  data: T;
  id?: string;
  retry?: number;
}

/**
 * Real-time update payload
 */
export interface RealtimePayload<T = unknown> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: T;
  old?: T;
  table: string;
  schema: string;
}
