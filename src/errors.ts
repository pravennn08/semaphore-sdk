export class SemaphoreConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SemaphoreConfigError";
  }
}

export class SemaphoreValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SemaphoreValidationError";
  }
}

export type SemaphoreApiErrorKind =
  "http" | "transport" | "timeout" | "cancelled" | "invalid_response";

export type SemaphoreSubmissionState = "not_sent" | "rejected" | "unknown";

export interface SemaphoreApiErrorOptions {
  readonly kind: SemaphoreApiErrorKind;
  readonly submission: SemaphoreSubmissionState;
  readonly statusCode?: number | null;
  readonly retryAfterSeconds?: number | null;
}

export class SemaphoreApiError extends Error {
  readonly kind: SemaphoreApiErrorKind;
  readonly submission: SemaphoreSubmissionState;
  readonly statusCode: number | null;
  readonly retryAfterSeconds: number | null;

  constructor(message: string, options: SemaphoreApiErrorOptions) {
    super(message);
    this.name = "SemaphoreApiError";
    this.kind = options.kind;
    this.submission = options.submission;
    this.statusCode = options.statusCode ?? null;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
  }
}
