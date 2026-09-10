import { SemaphoreValidationError } from "../../errors.js";
import { parseWireMessages, type WireMessage } from "../messages/schema.js";
import {
  normalizePhilippineMobileNumber,
  validateMessageBody,
  validateSenderName,
} from "../validation.js";
import type { SendOtpInput } from "./types.js";

export interface WireOtpMessage extends WireMessage {
  readonly code: string | number;
}

function normalizeOtpCode(code: unknown): string | undefined {
  if (code === undefined) {
    return undefined;
  }

  if (typeof code === "string" && /^\d+$/.test(code)) {
    return code;
  }

  if (typeof code === "number" && Number.isSafeInteger(code) && code >= 0) {
    return String(code);
  }

  throw new SemaphoreValidationError(
    "code must contain only digits when provided.",
  );
}

export interface ValidatedSendOtpInput {
  readonly recipient: string;
  readonly message: string;
  readonly senderName: string | undefined;
  readonly code: string | undefined;
}

export function validateSendOtpInput(
  input: SendOtpInput,
): ValidatedSendOtpInput {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new SemaphoreValidationError("send input must be an object.");
  }
  if (typeof input.to !== "string") {
    throw new SemaphoreValidationError(
      "OTP to must be a single recipient string.",
    );
  }

  validateMessageBody(input.message);
  validateSenderName(input.senderName);

  return {
    recipient: normalizePhilippineMobileNumber(input.to),
    message: input.message,
    senderName: input.senderName,
    code: normalizeOtpCode(input.code),
  };
}

export function parseWireOtpMessages(payload: unknown): WireOtpMessage[] {
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new TypeError("OTP response must be a non-empty array");
  }

  const messages = parseWireMessages(payload);
  return messages.map((message) => {
    if (message.code === undefined) {
      throw new TypeError("OTP response contains a missing code");
    }
    return { ...message, code: message.code };
  });
}
