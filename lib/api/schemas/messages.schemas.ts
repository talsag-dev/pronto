/**
 * Message API Request/Response Schemas
 *
 * Zod schemas for validating message-related API requests.
 */

import { z } from 'zod';
import { commonSchemas } from '../validation';

/**
 * Send message to a lead
 * POST /api/messages/send
 */
export const sendMessageSchema = z.object({
  leadId: commonSchemas.id,
  orgId: commonSchemas.id,
  message: z.string().min(1).max(4096, 'Message is too long'),
});

export type SendMessageRequest = z.infer<typeof sendMessageSchema>;

/**
 * Get messages for a lead
 * GET /api/messages?leadId=xxx
 */
export const getMessagesSchema = z.object({
  leadId: commonSchemas.id,
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  includeSystem: z.coerce.boolean().default(true),
});

export type GetMessagesRequest = z.infer<typeof getMessagesSchema>;
