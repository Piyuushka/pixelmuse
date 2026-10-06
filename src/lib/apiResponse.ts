import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Standardized Success Response
 */
export function apiSuccess<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Standardized Error Response
 */
export function apiError(message: string, code: string = 'BAD_REQUEST', status: number = 400, details?: any) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    { status }
  );
}

/**
 * Handles Zod and General Exceptions into standardized API responses
 */
export function handleApiError(err: unknown) {
  console.error('[API Error]:', err);

  if (err instanceof ZodError) {
    const formatted = err.issues.map((e: any) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return apiError('Validation failed', 'VALIDATION_ERROR', 422, formatted);
  }

  if (err instanceof Error) {
    if (err.message.includes('Unauthorized') || err.message.includes('auth')) {
      return apiError(err.message, 'UNAUTHORIZED', 401);
    }
    if (err.message.includes('Forbidden') || err.message.includes('denied')) {
      return apiError(err.message, 'FORBIDDEN', 403);
    }
    if (err.message.includes('not found')) {
      return apiError(err.message, 'NOT_FOUND', 404);
    }
    return apiError(err.message, 'BAD_REQUEST', 400);
  }

  return apiError('Internal server error', 'INTERNAL_SERVER_ERROR', 500);
}
