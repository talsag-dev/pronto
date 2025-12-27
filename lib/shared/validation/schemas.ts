/**
 * Validation schemas using Zod
 *
 * This module provides validation schemas for all API inputs and data structures.
 * Using Zod provides both runtime validation and TypeScript type inference.
 *
 * Usage:
 *   import { SendMessageSchema } from '@/lib/shared/validation/schemas';
 *   const validated = SendMessageSchema.parse(data); // Throws if invalid
 *   const result = SendMessageSchema.safeParse(data); // Returns { success, data/error }
 */

import { z } from 'zod';
import { LIMITS } from '../config/constants';

// ============================================================================
// Message Schemas
// ============================================================================

export const SendMessageSchema = z.object({
  leadId: z.string().uuid('Invalid lead ID'),
  orgId: z.string().uuid('Invalid organization ID'),
  message: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(LIMITS.MESSAGE_MAX_LENGTH, `Message too long (max ${LIMITS.MESSAGE_MAX_LENGTH} characters)`),
});

export type SendMessageInput = z.infer<typeof SendMessageSchema>;

export const MessageSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  lead_id: z.string().uuid(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  type: z.enum(['text', 'audio']).default('text'),
  token_usage: z.number().int().optional(),
  whatsapp_message_id: z.string().optional(),
  created_at: z.string().datetime(),
});

export type Message = z.infer<typeof MessageSchema>;

// ============================================================================
// Lead Schemas
// ============================================================================

export const CreateLeadSchema = z.object({
  phone: z
    .string()
    .min(LIMITS.PHONE_MIN_LENGTH, `Phone number must be at least ${LIMITS.PHONE_MIN_LENGTH} digits`),
  name: z.string().max(LIMITS.LEAD_NAME_MAX_LENGTH).optional(),
  organizationId: z.string().uuid('Invalid organization ID'),
  language_preference: z.enum(['he', 'en']).default('he'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateLeadInput = z.infer<typeof CreateLeadSchema>;

export const UpdateLeadSchema = z.object({
  leadId: z.string().uuid('Invalid lead ID'),
  name: z.string().max(LIMITS.LEAD_NAME_MAX_LENGTH).optional(),
  status: z.enum(['new', 'contacted', 'qualified', 'closed']).optional(),
  conversation_stage: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  language_preference: z.enum(['he', 'en']).optional(),
});

export type UpdateLeadInput = z.infer<typeof UpdateLeadSchema>;

export const ToggleAISchema = z.object({
  leadId: z.string().uuid('Invalid lead ID'),
  status: z.enum(['active', 'paused']),
});

export type ToggleAIInput = z.infer<typeof ToggleAISchema>;

export const LeadSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  phone: z.string(),
  name: z.string().nullable(),
  status: z.enum(['new', 'contacted', 'qualified', 'closed']),
  conversation_stage: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  language_preference: z.string(),
  ai_status: z.enum(['active', 'paused']).default('active'),
  last_message_at: z.string().datetime(),
  created_at: z.string().datetime(),
  real_phone: z.string().optional(),
});

export type Lead = z.infer<typeof LeadSchema>;

// ============================================================================
// Organization Schemas
// ============================================================================

export const CreateOrganizationSchema = z.object({
  name: z.string().min(1, 'Organization name is required'),
  business_phone: z
    .string()
    .min(LIMITS.PHONE_MIN_LENGTH, `Phone number must be at least ${LIMITS.PHONE_MIN_LENGTH} digits`),
  config: z.record(z.string(), z.unknown()).optional(),
  integrations: z.record(z.string(), z.unknown()).optional(),
});

export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>;

export const OrganizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  business_phone: z.string(),
  config: z.record(z.string(), z.unknown()),
  integrations: z.record(z.string(), z.unknown()),
  cal_access_token: z.string().nullable(),
  cal_refresh_token: z.string().nullable(),
  cal_user_id: z.string().nullable(),
  whatsapp_access_token: z.string().nullable(),
  whatsapp_phone_id: z.string().nullable(),
  whatsapp_business_id: z.string().nullable(),
  whatsapp_phone_number: z.string().nullable(),
  whatsapp_status: z.string().nullable(),
  owner_id: z.string().uuid().optional(),
  created_at: z.string().datetime(),
});

export type Organization = z.infer<typeof OrganizationSchema>;

// ============================================================================
// WhatsApp Schemas
// ============================================================================

export const WhatsAppSessionInitSchema = z.object({
  orgId: z.string().uuid('Invalid organization ID'),
  forceNew: z.boolean().default(false),
});

export type WhatsAppSessionInitInput = z.infer<typeof WhatsAppSessionInitSchema>;

export const WhatsAppPairingCodeSchema = z.object({
  orgId: z.string().uuid('Invalid organization ID'),
  phoneNumber: z.string().min(LIMITS.PHONE_MIN_LENGTH),
});

export type WhatsAppPairingCodeInput = z.infer<typeof WhatsAppPairingCodeSchema>;

export const WhatsAppSendMessageSchema = z.object({
  orgId: z.string().uuid('Invalid organization ID'),
  to: z.string().min(LIMITS.PHONE_MIN_LENGTH),
  message: z.string().min(1).max(LIMITS.MESSAGE_MAX_LENGTH),
});

export type WhatsAppSendMessageInput = z.infer<typeof WhatsAppSendMessageSchema>;

// ============================================================================
// Webhook Schemas
// ============================================================================

export const WebhookPayloadSchema = z.object({
  orgId: z.string().uuid(),
  message: z.object({
    key: z.object({
      remoteJid: z.string(),
      fromMe: z.boolean(),
      id: z.string(),
    }),
    message: z.record(z.string(), z.unknown()),
  }),
});

export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

// ============================================================================
// Pagination Schemas
// ============================================================================

export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z
    .number()
    .int()
    .positive()
    .max(100, 'Page size cannot exceed 100')
    .default(25),
});

export type PaginationInput = z.infer<typeof PaginationSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validates data against a schema and throws a descriptive error if invalid
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Validation failed: ${errors}`);
    }
    throw error;
  }
}

/**
 * Validates data and returns result object instead of throwing
 */
export function validateSafe<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues
    .map((e) => `${e.path.join('.')}: ${e.message}`)
    .join(', ');

  return { success: false, error: errors };
}
