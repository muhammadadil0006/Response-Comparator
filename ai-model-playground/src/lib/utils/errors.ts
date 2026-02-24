export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitizeErrorMessage(message: string): string {
  const trimmed = message.trim();
  const withoutHttpPrefix = trimmed.replace(/^HTTP\s+\d+\s*:\s*/i, '');
  const withoutStatusCodePrefix = withoutHttpPrefix.replace(/^\d{3}\s+/, '');
  return withoutStatusCodePrefix || 'Unexpected error';
}

export function extractErrorMessage(
  error: unknown,
  fallback: string = 'Unexpected error'
): string {
  if (typeof error === 'string') {
    return sanitizeErrorMessage(error);
  }

  if (!isObject(error)) {
    return fallback;
  }

  const directMessage = error.message;
  if (typeof directMessage === 'string' && directMessage.trim()) {
    return sanitizeErrorMessage(directMessage);
  }

  const nestedError = error.error;
  if (typeof nestedError === 'string' && nestedError.trim()) {
    return sanitizeErrorMessage(nestedError);
  }

  if (isObject(nestedError)) {
    const nestedMessage = extractErrorMessage(nestedError, '');
    if (nestedMessage) {
      return sanitizeErrorMessage(nestedMessage);
    }
  }

  const response = error.response;
  if (isObject(response)) {
    const responseData = response.data;
    if (isObject(responseData)) {
      const responseMessage = extractErrorMessage(responseData, '');
      if (responseMessage) {
        return sanitizeErrorMessage(responseMessage);
      }
    }
  }

  const data = error.data;
  if (isObject(data)) {
    const dataMessage = extractErrorMessage(data, '');
    if (dataMessage) {
      return sanitizeErrorMessage(dataMessage);
    }
  }

  return fallback;
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Invalid input') {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}
