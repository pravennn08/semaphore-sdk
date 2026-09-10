import { SemaphoreValidationError } from "../errors.js";

export const MAX_RECIPIENTS = 1_000;

export function normalizePhilippineMobileNumber(value: string): string {
  const compact = value.trim().replace(/[\s()-]/g, "");

  if (/^\+639\d{9}$/.test(compact)) {
    return compact.slice(1);
  }
  if (/^639\d{9}$/.test(compact)) {
    return compact;
  }
  if (/^09\d{9}$/.test(compact)) {
    return `63${compact.slice(1)}`;
  }
  if (/^9\d{9}$/.test(compact)) {
    return `63${compact}`;
  }

  throw new SemaphoreValidationError(
    "to contains an invalid Philippine mobile number.",
  );
}

export function normalizeRecipients(
  input: string | readonly string[],
): string[] {
  const values = typeof input === "string" ? [input] : input;
  if (
    !Array.isArray(values) ||
    values.length === 0 ||
    values.length > MAX_RECIPIENTS
  ) {
    throw new SemaphoreValidationError(
      `to must contain between 1 and ${MAX_RECIPIENTS} recipients.`,
    );
  }

  return Array.from(values, (value) => {
    if (typeof value !== "string") {
      throw new SemaphoreValidationError("to must contain only strings.");
    }
    return normalizePhilippineMobileNumber(value);
  });
}

export function validateMessageBody(
  message: unknown,
): asserts message is string {
  if (typeof message !== "string") {
    throw new SemaphoreValidationError("message must be a string.");
  }

  const trimmedStart = message.trimStart();
  if (trimmedStart.length === 0) {
    throw new SemaphoreValidationError("message cannot be blank.");
  }
  if (/^test\b/i.test(trimmedStart)) {
    throw new SemaphoreValidationError(
      'message cannot begin with "TEST" because Semaphore ignores it.',
    );
  }
}

export function validateSenderName(
  senderName: unknown,
): asserts senderName is string | undefined {
  if (
    senderName !== undefined &&
    (typeof senderName !== "string" || senderName.trim().length === 0)
  ) {
    throw new SemaphoreValidationError(
      "senderName must be a nonblank string when provided.",
    );
  }
}
