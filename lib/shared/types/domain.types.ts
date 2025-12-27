/**
 * Domain type definitions
 *
 * This module exports domain entity types used throughout the application.
 * Types are primarily derived from Zod schemas for consistency between
 * runtime validation and compile-time type checking.
 */

// Import types from validation schemas
import type {
  Lead as LeadBase,
  Message as MessageBase,
  Organization as OrganizationBase,
} from '../validation/schemas';

// Re-export domain entity types
export type Lead = LeadBase;
export type Message = MessageBase;
export type Organization = OrganizationBase;

// Re-export type aliases from constants
export type {
  LeadStatus,
  MessageRole,
  MessageType,
  WhatsAppStatus,
  AIStatus,
  Language,
} from '../config/constants';

// Re-export constants
export {
  LEAD_STATUS,
  MESSAGE_ROLE,
  MESSAGE_TYPE,
  WHATSAPP_STATUS,
  AI_STATUS,
  LANGUAGE,
} from '../config/constants';

/**
 * User type (from Supabase auth)
 */
export interface User {
  id: string;
  email: string;
  app_metadata: {
    provider?: string;
    [key: string]: unknown;
  };
  user_metadata: {
    [key: string]: unknown;
  };
  created_at: string;
}

/**
 * Member type (links users to organizations)
 */
export interface Member {
  id: string;
  organization_id: string;
  role: 'owner' | 'admin' | 'member';
  created_at: string;
}

/**
 * Lead with computed/helper fields for UI display
 */
export interface LeadWithDisplay extends Lead {
  formattedPhone: string;
  initials: string;
  displayName: string;
}

/**
 * Organization with populated relationships
 */
export interface OrganizationWithMembers extends Organization {
  members: Member[];
  memberCount: number;
}

/**
 * Conversation thread (lead with messages)
 */
export interface Conversation {
  lead: Lead;
  messages: Message[];
  unreadCount: number;
  lastMessageAt: string;
}

/**
 * Analytics event data
 */
export interface AnalyticsEvent {
  event: string;
  properties?: Record<string, unknown>;
  timestamp: string;
  userId?: string;
}

/**
 * WhatsApp session state
 */
export interface WhatsAppSession {
  session_id: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Metrics data for dashboard
 */
export interface DashboardMetrics {
  totalLeads: number;
  newLeads: number;
  contactedLeads: number;
  qualifiedLeads: number;
  closedLeads: number;
  meetingsBooked: number;
  averageResponseTime: number | null;
  conversionRate: number;
}

/**
 * Chart data point
 */
export interface ChartDataPoint {
  stage: string;
  count: number;
}
