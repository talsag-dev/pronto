/**
 * API Response Utilities
 *
 * Standardized response helpers for API routes.
 * Provides consistent response format across all endpoints.
 */

import { NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/shared/types';

/**
 * Create a success response with data
 */
export function successResponse<T>(data: T, status = 200) {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };
  return NextResponse.json(response, { status });
}

/**
 * Create an error response
 */
export function errorResponse(
  message: string,
  status = 500,
  code?: string
) {
  const response: ApiResponse<never> = {
    success: false,
    error: message,
    code,
  };
  return NextResponse.json(response, { status });
}

/**
 * Common error responses
 */
export const commonErrors = {
  unauthorized: () => errorResponse('Unauthorized', 401, 'UNAUTHORIZED'),
  forbidden: () => errorResponse('Forbidden', 403, 'FORBIDDEN'),
  notFound: (resource?: string) =>
    errorResponse(
      resource ? `${resource} not found` : 'Not found',
      404,
      'NOT_FOUND'
    ),
  badRequest: (message = 'Bad request') =>
    errorResponse(message, 400, 'BAD_REQUEST'),
  validation: (message = 'Validation failed') =>
    errorResponse(message, 400, 'VALIDATION_ERROR'),
  internal: (message = 'Internal server error') =>
    errorResponse(message, 500, 'INTERNAL_ERROR'),
};
