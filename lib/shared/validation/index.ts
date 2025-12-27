/**
 * Validation index
 *
 * Centralized exports for all validation schemas and utilities.
 */

// Schemas
export {
  SendMessageSchema,
  MessageSchema,
  CreateLeadSchema,
  UpdateLeadSchema,
  ToggleAISchema,
  LeadSchema,
  CreateOrganizationSchema,
  OrganizationSchema,
  WhatsAppSessionInitSchema,
  WhatsAppPairingCodeSchema,
  WhatsAppSendMessageSchema,
  WebhookPayloadSchema,
  PaginationSchema,
} from './schemas';

// Schema input types
export type {
  SendMessageInput,
  Message,
  CreateLeadInput,
  UpdateLeadInput,
  ToggleAIInput,
  Lead,
  CreateOrganizationInput,
  Organization,
  WhatsAppSessionInitInput,
  WhatsAppPairingCodeInput,
  WhatsAppSendMessageInput,
  WebhookPayload,
  PaginationInput,
} from './schemas';

// Validation utilities
export { validate, validateSafe } from './schemas';
