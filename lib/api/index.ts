/**
 * API Utilities Index
 *
 * Centralized exports for all API utilities.
 */

// Auth utilities
export {
  getAuthenticatedUser,
  getUserOrganization,
  verifyOrganizationOwnership,
  requireAuth,
  requireOrganizationOwnership,
  isAdmin,
  requireAdmin,
} from './auth';

// Response utilities
export { successResponse, errorResponse, commonErrors } from './response';

// Error handling
export { handleApiError, withErrorHandler } from './errors';

// Validation utilities
export { validateRequest, validateQuery, commonSchemas } from './validation';
