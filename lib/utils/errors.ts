export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode = 500,
    public context?: Record<string, any>,
  ) {
    super(message)
    this.name = "AppError"
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, "DATABASE_ERROR", 500, context)
    this.name = "DatabaseError"
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, context?: Record<string, any>) {
    super(`${resource} not found`, "NOT_FOUND", 404, context)
    this.name = "NotFoundError"
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Authentication required", context?: Record<string, any>) {
    super(message, "AUTH_ERROR", 401, context)
    this.name = "AuthenticationError"
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, "VALIDATION_ERROR", 400, context)
    this.name = "ValidationError"
  }
}

export class PermissionError extends AppError {
  constructor(message = "Permission denied", context?: Record<string, any>) {
    super(message, "PERMISSION_ERROR", 403, context)
    this.name = "PermissionError"
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === "string") {
    return error
  }
  return "An unexpected error occurred"
}

export function handleDatabaseError(error: any, operation: string): never {
  console.error(`Database error during ${operation}:`, error)
  throw new DatabaseError(`Failed to ${operation}`, { originalError: error?.message, code: error?.code })
}
