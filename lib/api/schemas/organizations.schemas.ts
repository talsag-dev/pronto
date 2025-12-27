/**
 * Organization API Request/Response Schemas
 *
 * Zod schemas for validating organization-related API requests.
 */

import { z } from 'zod';
import { commonSchemas } from '../validation';

/**
 * Create organization during onboarding (simplified)
 * POST /api/onboarding/create-org
 * Note: businessPhone is generated as placeholder until WhatsApp is connected
 */
export const onboardingCreateOrgSchema = z.object({
  businessName: z.string().min(1).max(255, 'Business name is too long'),
});

export type OnboardingCreateOrgRequest = z.infer<typeof onboardingCreateOrgSchema>;

/**
 * Create organization (full)
 * POST /api/organizations
 */
export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(255, 'Organization name is too long'),
  businessPhone: commonSchemas.phoneNumber,
  config: z.record(z.string(), z.unknown()).optional(),
  integrations: z.record(z.string(), z.unknown()).optional(),
});

export type CreateOrganizationRequest = z.infer<typeof createOrganizationSchema>;

/**
 * Update organization
 * PATCH /api/organizations/:id
 */
export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  businessPhone: commonSchemas.phoneNumber.optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  integrations: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateOrganizationRequest = z.infer<typeof updateOrganizationSchema>;

/**
 * Update WhatsApp integration
 * PATCH /api/organizations/:id/whatsapp
 */
export const updateWhatsAppIntegrationSchema = z.object({
  status: z.enum(['connected', 'disconnected', 'error']).optional(),
});

export type UpdateWhatsAppIntegrationRequest = z.infer<typeof updateWhatsAppIntegrationSchema>;

/**
 * Update Cal.com integration
 * PATCH /api/organizations/:id/cal
 */
export const updateCalIntegrationSchema = z.object({
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  userId: z.string().optional(),
});

export type UpdateCalIntegrationRequest = z.infer<typeof updateCalIntegrationSchema>;

/**
 * Request WhatsApp pairing code
 * POST /api/whatsapp/pairing
 */
export const whatsAppPairingSchema = z.object({
  phoneNumber: commonSchemas.phoneNumber,
});

export type WhatsAppPairingRequest = z.infer<typeof whatsAppPairingSchema>;

/**
 * OAuth callback query parameters
 * GET /api/auth/cal/callback?code=xxx&state=xxx
 */
export const oauthCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().uuid('State must be a valid organization ID'),
});

export type OAuthCallbackRequest = z.infer<typeof oauthCallbackSchema>;
