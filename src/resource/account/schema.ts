import { SemaphoreValidationError } from "../../errors.js";
import { validatePagination } from "../pagination.js";
import type {
  ListAccountItemsInput,
  SemaphoreAccountTransaction,
} from "./types.js";

export interface WireAccount {
  readonly account_id: string | number;
  readonly account_name: string;
  readonly status: string;
  readonly credit_balance: number;
}

export interface WireSenderName {
  readonly name: string;
  readonly status: string;
  readonly created_at: string | null;
}

export interface WireAccountUser {
  readonly user_id: string | number;
  readonly email: string;
  readonly role: string;
  readonly status: string | null;
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("account response must contain an object");
  }
  return value as Record<string, unknown>;
}

function string(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError("account response contains an invalid string");
  }
  return value;
}

function nullableString(value: unknown): string | null {
  return value === undefined || value === null ? null : string(value);
}

function id(value: unknown): string | number {
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }
  throw new TypeError("account response contains an invalid id");
}

function creditBalance(value: unknown): number {
  if (typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value.trim())) {
    value = Number(value);
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError("account response contains an invalid credit balance");
  }
  return value;
}

function records(payload: unknown): Record<string, unknown>[] {
  if (!Array.isArray(payload)) {
    throw new TypeError("account list response must be an array");
  }
  return payload.map(record);
}

export function validateListAccountInput(
  input?: ListAccountItemsInput,
): Record<string, string> {
  if (input === undefined) {
    return {};
  }
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new SemaphoreValidationError("account list input must be an object.");
  }
  return validatePagination(input);
}

export function parseWireAccount(payload: unknown): WireAccount {
  if (Array.isArray(payload)) {
    if (payload.length !== 1) {
      throw new TypeError("account response must contain exactly one record");
    }
    payload = payload[0];
  }
  const value = record(payload);
  return {
    account_id: id(value.account_id),
    account_name: string(value.account_name),
    status: string(value.status),
    credit_balance: creditBalance(value.credit_balance),
  };
}

export function parseTransactions(
  payload: unknown,
): SemaphoreAccountTransaction[] {
  return records(payload).map((value) => ({ ...value }));
}

export function parseWireSenderNames(payload: unknown): WireSenderName[] {
  return records(payload).map((value) => ({
    name: string(value.name),
    status: string(value.status),
    created_at: nullableString(value.created_at),
  }));
}

export function parseWireAccountUsers(payload: unknown): WireAccountUser[] {
  return records(payload).map((value) => ({
    user_id: id(value.user_id),
    email: string(value.email),
    role: string(value.role),
    status: nullableString(value.status),
  }));
}
