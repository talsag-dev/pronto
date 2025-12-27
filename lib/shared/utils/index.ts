/**
 * Utilities index
 *
 * Centralized exports for all utility functions.
 */

// Phone utilities
export {
  formatPhoneNumber,
  getPhoneInitials,
  isValidPhoneNumber,
  normalizePhoneNumber,
  getPhoneCountryCode,
} from './phone';

// Error utilities
export {
  AppError,
  AuthError,
  ValidationError,
  NotFoundError,
  DatabaseError,
  ExternalServiceError,
  RateLimitError,
  formatErrorResponse,
  isOperationalError,
  getErrorMessage,
  isAppError,
} from './errors';

// Logger utilities
export {
  logger,
  logApiRequest,
  logDatabaseOperation,
  logExternalService,
} from './logger';
