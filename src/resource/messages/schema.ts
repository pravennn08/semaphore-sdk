import { SemaphoreValidationError } from "../../errors.js";
import {
  normalizeRecipients,
  validateMessageBody,
  validateSenderName,
} from "../validation.js";
import type { SendSmsInput } from "./types.js";

export {
  normalizePhilippineMobileNumber,
  normalizeRecipients,
} from "../validation.js";

export interface WireMessage {
  readonly message_id: string | number;
  readonly recipient: string;
  readonly sender_name?: string | null;
  readonly status: string;
  readonly code?: string | number;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface ValidatedSendInput {
  readonly recipients: string[];
  readonly message: string;
  readonly senderName: string | undefined;
}

export function validateSendInput(input: SendSmsInput): ValidatedSendInput {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new SemaphoreValidationError("send input must be an object.");
  }

  validateMessageBody(input.message);
  validateSenderName(input.senderName);

  return {
    recipients: normalizeRecipients(input.to),
    message: input.message,
    senderName: input.senderName,
  };
}

export function parseWireMessages(payload: unknown): WireMessage[] {
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new TypeError("message response must be a non-empty array");
  }

  return payload.map((value) => {
    if (!isRecord(value)) {
      throw new TypeError("message response contains an invalid record");
    }

    const messageId = value.message_id;
    const recipient = value.recipient;
    const status = value.status;
    const senderName = value.sender_name;
    const code = value.code;
    const validId =
      (typeof messageId === "string" && messageId.trim().length > 0) ||
      (typeof messageId === "number" &&
        Number.isSafeInteger(messageId) &&
        messageId >= 0);

    if (
      !validId ||
      typeof recipient !== "string" ||
      recipient.trim() === "" ||
      typeof status !== "string" ||
      status.trim() === ""
    ) {
      throw new TypeError("message response contains invalid fields");
    }
    if (
      senderName !== undefined &&
      senderName !== null &&
      typeof senderName !== "string"
    ) {
      throw new TypeError("message response contains an invalid sender name");
    }
    if (
      code !== undefined &&
      !(
        (typeof code === "string" && code.trim().length > 0) ||
        (typeof code === "number" && Number.isSafeInteger(code) && code >= 0)
      )
    ) {
      throw new TypeError("message response contains an invalid code");
    }

    return {
      message_id: messageId,
      recipient,
      sender_name: senderName === undefined ? null : senderName,
      status,
      ...(code === undefined ? {} : { code }),
    };
  });
}
