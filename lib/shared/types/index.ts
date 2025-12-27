/**
 * Type definitions index
 *
 * Centralized exports for all type definitions.
 * This makes imports cleaner throughout the application.
 */

// Domain types
export type {
  User,
  LeadWithDisplay,
  OrganizationWithMembers,
  Conversation,
  AnalyticsEvent,
  DashboardMetrics,
  ChartDataPoint,
} from "./domain.types";

export {
  LEAD_STATUS,
  MESSAGE_ROLE,
  MESSAGE_TYPE,
  WHATSAPP_STATUS,
  AI_STATUS,
  LANGUAGE,
} from "./domain.types";

// API types
export type {
  ApiResponse,
  PaginatedResponse,
  SendMessageRequest,
  SendMessageResponse,
  GetMessagesRequest,
  GetMessagesResponse,
  CreateLeadRequest,
  CreateLeadResponse,
  UpdateLeadRequest,
  UpdateLeadResponse,
  ToggleAIRequest,
  ToggleAIResponse,
  GetLeadsRequest,
  GetLeadsResponse,
  CreateOrganizationRequest,
  CreateOrganizationResponse,
  GetOrganizationRequest,
  GetOrganizationResponse,
  WhatsAppSessionInitRequest,
  WhatsAppSessionInitResponse,
  WhatsAppPairingCodeRequest,
  WhatsAppPairingCodeResponse,
  WhatsAppSendMessageRequest,
  WhatsAppSendMessageResponse,
  WhatsAppSessionStatusRequest,
  WhatsAppSessionStatusResponse,
  WhatsAppDisconnectRequest,
  WhatsAppDisconnectResponse,
  WebhookPayloadRequest,
  WebhookPayloadResponse,
  LoginRequest,
  LoginResponse,
  SignupRequest,
  SignupResponse,
  ApiError,
  SSEMessage,
  RealtimePayload,
} from "./api.types";

// Database types
export type {
  Database,
  Json,
  Organization,
  CreateOrganization,
  UpdateOrganization,
  Lead,
  CreateLead,
  UpdateLead,
  Message,
  CreateMessage,
  UpdateMessage,
  Member,
  CreateMember,
  UpdateMember,
  WhatsAppSession,
  CreateWhatsAppSession,
  UpdateWhatsAppSession,
} from "./database.types";
