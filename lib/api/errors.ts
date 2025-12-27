/**
 * API Error Handling
 *
 * Centralized error handling for API routes.
 * Converts various error types into appropriate HTTP responses.
 */

import { ZodError } from 'zod';
import { PostgrestError } from '@supabase/supabase-js';
import { errorResponse, commonErrors } from './response';
import { DatabaseError, NotFoundError, logger } from '@/lib/shared/utils';

/**
 * Context information for error logging
 */
export interface ErrorContext {
  endpoint?: string;
  method?: string;
  userId?: string;
  orgId?: string;
  requestBody?: Record<string, any>;
}

/**
 * Handle API errors and convert to appropriate HTTP response
 */
export function handleApiError(error: unknown, context?: ErrorContext) {
  // Zod validation errors
  if (error instanceof ZodError) {
    // Extract field-specific errors for better user experience
    const fieldErrors = error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));

    // Create user-friendly message
    const userMessage = error.issues
      .map((e) => {
        const field = e.path.join('.') || 'request';
        return `${field}: ${e.message}`;
      })
      .join(', ');

    // Log with full context
    logger.warn('Validation error', {
      endpoint: context?.endpoint,
      method: context?.method,
      userId: context?.userId,
      orgId: context?.orgId,
      fieldErrors,
      requestBody: context?.requestBody,
    });

    return commonErrors.validation(userMessage);
  }

  // Domain-specific errors
  if (error instanceof NotFoundError) {
    logger.warn('Not found error', {
      endpoint: context?.endpoint,
      message: error.message,
      userId: context?.userId,
    });
    return commonErrors.notFound(error.message);
  }

  if (error instanceof DatabaseError) {
    logger.error('Database error', {
      error,
      endpoint: context?.endpoint,
      userId: context?.userId,
      orgId: context?.orgId,
    });
    return errorResponse('Database operation failed', 500, 'DATABASE_ERROR');
  }

  // Supabase/Postgrest errors
  if (isPostgrestError(error)) {
    logger.error('Postgrest error', {
      error,
      code: error.code,
      details: error.details,
      endpoint: context?.endpoint,
      userId: context?.userId,
    });
    return errorResponse(error.message, 500, 'DATABASE_ERROR');
  }

  // Auth errors
  if (error instanceof Error && error.message === 'Unauthorized') {
    logger.warn('Unauthorized access attempt', {
      endpoint: context?.endpoint,
      userId: context?.userId,
    });
    return commonErrors.unauthorized();
  }

  if (error instanceof Error && error.message === 'Forbidden') {
    logger.warn('Forbidden access attempt', {
      endpoint: context?.endpoint,
      userId: context?.userId,
    });
    return commonErrors.forbidden();
  }

  // Generic errors
  if (error instanceof Error) {
    logger.error('API error', {
      error,
      message: error.message,
      stack: error.stack,
      endpoint: context?.endpoint,
      userId: context?.userId,
      orgId: context?.orgId,
    });
    return errorResponse(error.message, 500);
  }

  // Unknown errors
  logger.error('Unknown error', {
    error,
    endpoint: context?.endpoint,
    userId: context?.userId,
  });
  return commonErrors.internal();
}

/**
 * Type guard for PostgrestError
 */
function isPostgrestError(error: unknown): error is PostgrestError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'details' in error
  );
}

/**
 * Async error handler wrapper for API routes
 * Catches errors and converts them to appropriate responses
 * Automatically extracts request context for better error logging
 */
export function withErrorHandler(
  handler: (request: Request, ...args: any[]) => Promise<Response>
): (request: Request, ...args: any[]) => Promise<Response> {
  return async (request: Request, ...args: any[]) => {
    try {
      return await handler(request, ...args);
    } catch (error) {
      // Extract request context for better error logging
      const context: ErrorContext = {
        endpoint: new URL(request.url).pathname,
        method: request.method,
      };

      // Try to extract request body for validation error context
      // Clone the request to avoid "body already read" errors
      try {
        const clonedRequest = request.clone();
        const body = await clonedRequest.json();
        context.requestBody = body;
      } catch {
        // Body not JSON or already consumed - skip
      }

      return handleApiError(error, context);
    }
  };
}
