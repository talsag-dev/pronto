/**
 * Application-wide constants
 *
 * This module contains all constants used throughout the application.
 * Centralizing constants makes them easier to maintain and update.
 */

export const APP_NAME = 'Pronto' as const;
export const APP_DESCRIPTION = 'Intelligent Response System' as const;

// Lead statuses
export const LEAD_STATUS = {
  NEW: 'new',
  CONTACTED: 'contacted',
  QUALIFIED: 'qualified',
  CLOSED: 'closed',
} as const;

export type LeadStatus = (typeof LEAD_STATUS)[keyof typeof LEAD_STATUS];

// Message roles
export const MESSAGE_ROLE = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
} as const;

export type MessageRole = (typeof MESSAGE_ROLE)[keyof typeof MESSAGE_ROLE];

// Message types
export const MESSAGE_TYPE = {
  TEXT: 'text',
  AUDIO: 'audio',
} as const;

export type MessageType = (typeof MESSAGE_TYPE)[keyof typeof MESSAGE_TYPE];

// WhatsApp connection status
export const WHATSAPP_STATUS = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  NOT_STARTED: 'not_started',
  QR: 'qr',
  LOGGED_OUT: 'logged_out',
} as const;

export type WhatsAppStatus = (typeof WHATSAPP_STATUS)[keyof typeof WHATSAPP_STATUS];

// AI status
export const AI_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
} as const;

export type AIStatus = (typeof AI_STATUS)[keyof typeof AI_STATUS];

// Language preferences
export const LANGUAGE = {
  HEBREW: 'he',
  ENGLISH: 'en',
} as const;

export type Language = (typeof LANGUAGE)[keyof typeof LANGUAGE];

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 25,
  MAX_PAGE_SIZE: 100,
} as const;

// Timeouts (in milliseconds)
export const TIMEOUTS = {
  API_REQUEST: 30000, // 30 seconds
  SSE_RECONNECT: 5000, // 5 seconds
  DEBOUNCE: 300, // 300ms
} as const;

// Animation durations (in seconds)
export const ANIMATION = {
  STAGGER_CHILDREN: 0.1,
  FADE_IN: 0.2,
  HOVER: 0.2,
} as const;

// Limits
export const LIMITS = {
  MESSAGE_MAX_LENGTH: 4000,
  LEAD_NAME_MAX_LENGTH: 255,
  PHONE_MIN_LENGTH: 8,
} as const;
