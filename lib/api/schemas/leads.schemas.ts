/**
 * Lead API Request/Response Schemas
 *
 * Zod schemas for validating lead-related API requests.
 */

import { z } from 'zod';
import { commonSchemas } from '../validation';

/**
 * Toggle AI status for a lead
 * POST /api/leads/toggle-ai
 */
export const toggleAISchema = z.object({
  leadId: commonSchemas.id,
  status: z.enum(['active', 'paused']),
});

export type ToggleAIRequest = z.infer<typeof toggleAISchema>;

/**
 * Update lead
 * PATCH /api/leads/:id
 */
export const updateLeadSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: z.enum(['new', 'contacted', 'qualified', 'closed']).optional(),
  conversationStage: z.string().max(255).optional(),
  aiStatus: z.enum(['active', 'paused']).optional(),
  languagePreference: z.enum(['he', 'en']).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateLeadRequest = z.infer<typeof updateLeadSchema>;

/**
 * Create lead
 * POST /api/leads
 */
export const createLeadSchema = z.object({
  organizationId: commonSchemas.id,
  phone: commonSchemas.phoneNumber,
  name: z.string().min(1).max(255).optional(),
  languagePreference: z.enum(['he', 'en']).default('he'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateLeadRequest = z.infer<typeof createLeadSchema>;
