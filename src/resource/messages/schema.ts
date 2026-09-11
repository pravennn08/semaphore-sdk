import { SemaphoreValidationError } from "../../errors.js";
import {
  normalizeRecipients,
  validateMessageBody,
  validateSenderName,
} from "../validation.js";
import type { ListMessagesInput, SendSmsInput } from "./types.js";

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

export interface ValidatedListMessagesInput {
  readonly query: Record<string, string>;
}

function validatePositiveInteger(
  name: string,
  value: number | undefined,
  maximum?: number,
): void {
  if (
    value !== undefined &&
    (!Number.isSafeInteger(value) ||
      value < 1 ||
      (maximum !== undefined && value > maximum))
  ) {
    const range =
      maximum === undefined ? "at least 1" : `between 1 and ${maximum}`;
    throw new SemaphoreValidationError(`${name} must be an integer ${range}.`);
  }
}

function validateDate(name: string, value: string | undefined): void {
  if (value === undefined) {
    return;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new SemaphoreValidationError(`${name} must use YYYY-MM-DD format.`);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new SemaphoreValidationError(
      `${name} must be a valid calendar date.`,
    );
  }
}

export function validateListMessagesInput(
  input: ListMessagesInput | undefined,
): ValidatedListMessagesInput {
  if (input === undefined) {
    return { query: {} };
  }
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new SemaphoreValidationError("list input must be an object.");
  }

  validatePositiveInteger("limit", input.limit, 1_000);
  validatePositiveInteger("page", input.page);
  validateDate("startDate", input.startDate);
  validateDate("endDate", input.endDate);

  if (
    input.startDate !== undefined &&
    input.endDate !== undefined &&
    input.startDate > input.endDate
  ) {
    throw new SemaphoreValidationError("startDate cannot be after endDate.");
  }

  const query: Record<string, string> = {};
  if (input.limit !== undefined) {
    query.limit = String(input.limit);
  }
  if (input.page !== undefined) {
    query.page = String(input.page);
  }
  if (input.startDate !== undefined) {
    query.startDate = input.startDate;
  }
  if (input.endDate !== undefined) {
    query.endDate = input.endDate;
  }
  if (input.network !== undefined) {
    if (typeof input.network !== "string" || input.network.trim() === "") {
      throw new SemaphoreValidationError("network must be a nonblank string.");
    }
    query.network = input.network.trim().toLowerCase();
  }
  if (input.status !== undefined) {
    if (typeof input.status !== "string" || input.status.trim() === "") {
      throw new SemaphoreValidationError("status must be a nonblank string.");
    }
    query.status = input.status.trim().toLowerCase();
  }

  return { query };
}

export function validateMessageId(messageId: string | number): string {
  if (typeof messageId === "string" && messageId.trim() !== "") {
    return messageId.trim();
  }
  if (
    typeof messageId === "number" &&
    Number.isSafeInteger(messageId) &&
    messageId >= 0
  ) {
    return String(messageId);
  }
  throw new SemaphoreValidationError(
    "messageId must be a nonblank string or a nonnegative integer.",
  );
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

export function parseWireMessages(
  payload: unknown,
  options: { readonly allowEmpty?: boolean } = {},
): WireMessage[] {
  if (
    !Array.isArray(payload) ||
    (!options.allowEmpty && payload.length === 0)
  ) {
    throw new TypeError(
      options.allowEmpty
        ? "message response must be an array"
        : "message response must be a non-empty array",
    );
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

export function parseWireMessage(payload: unknown): WireMessage {
  const records = Array.isArray(payload)
    ? parseWireMessages(payload)
    : parseWireMessages([payload]);
  if (records.length !== 1) {
    throw new TypeError(
      "single message response must contain exactly one record",
    );
  }
  return records[0];
}
