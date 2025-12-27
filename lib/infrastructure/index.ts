/**
 * Infrastructure Layer Exports
 *
 * This is the main export point for the infrastructure layer.
 * All database access, external services, and clients are exported from here.
 */

// Database
export {
  supabaseAdmin,
  supabaseServer,
  supabaseBrowser,
  getCurrentUser,
  getCurrentOrgId,
} from './database/supabase.client';

// Repositories
export {
  BaseRepository,
  LeadsRepository,
  MessagesRepository,
  OrganizationsRepository,
} from './repositories';

export type {
  LeadWithDisplay,
  CreateLeadParams,
  UpdateLeadParams,
  CreateMessageParams,
  MessageWithLead,
  CreateOrganizationParams,
  UpdateOrganizationParams,
  WhatsAppIntegration,
  CalIntegration,
} from './repositories';

// External Service Clients
export {
  BaileysClient,
  baileysClient,
  OpenAIClient,
  openAIClient,
  MixpanelClient,
  mixpanelClient,
} from './clients';

export type {
  BaileysSendMessageParams,
  BaileysSendMessageResponse,
  InitSessionParams,
  SessionStatusResponse,
  PairingCodeParams,
  PairingCodeResponse,
  ChatMessage,
  ChatCompletionParams,
  ChatCompletionResponse,
  TrackEventParams,
  UserProperties,
} from './clients';
