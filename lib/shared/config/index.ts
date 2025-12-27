/**
 * Configuration index
 *
 * Centralized exports for all configuration.
 */

// Environment configuration
export { env, validateEnv, type Env } from './env';

// Constants
export {
  APP_NAME,
  APP_DESCRIPTION,
  LEAD_STATUS,
  MESSAGE_ROLE,
  MESSAGE_TYPE,
  WHATSAPP_STATUS,
  AI_STATUS,
  LANGUAGE,
  PAGINATION,
  TIMEOUTS,
  ANIMATION,
  LIMITS,
  type LeadStatus,
  type MessageRole,
  type MessageType,
  type WhatsAppStatus,
  type AIStatus,
  type Language,
} from './constants';
