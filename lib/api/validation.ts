/**
 * API Request Validation
 *
 * Utilities for validating API requests with Zod schemas.
 * Provides type-safe request parsing and validation.
 */

import { z, ZodSchema } from 'zod';

/**
 * Parse and validate request body
 * Throws ZodError if validation fails
 */
export async function validateRequest<T extends ZodSchema>(
  request: Request,
  schema: T
): Promise<z.infer<T>> {
  const body = await request.json();
  return schema.parse(body);
}

/**
 * Parse and validate query parameters
 * Throws ZodError if validation fails
 */
export function validateQuery<T extends ZodSchema>(
  searchParams: URLSearchParams,
  schema: T
): z.infer<T> {
  const params = Object.fromEntries(searchParams.entries());
  return schema.parse(params);
}

/**
 * Normalize phone number by removing formatting characters
 * Keeps leading '+' for international format, removes spaces, dashes, parentheses
 */
function normalizePhoneNumber(phone: string): string {
  // Keep leading '+' if present, remove all other non-digit characters
  const hasPlus = phone.startsWith('+');
  const cleaned = phone.replace(/[^\d]/g, '');
  return hasPlus ? `+${cleaned}` : cleaned;
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  id: z.string().uuid('Invalid ID format'),
  pagination: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
  }),
  phoneNumber: z
    .string()
    .transform((val) => normalizePhoneNumber(val))
    .pipe(z.string().min(10, 'Phone number must be at least 10 digits').max(15, 'Phone number must be at most 15 digits')),
  email: z.string().email(),
};
