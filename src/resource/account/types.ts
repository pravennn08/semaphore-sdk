import type { ApiResponse, RequestOptions } from "../../core/request.js";
import type { PaginationInput } from "../pagination.js";

export interface SemaphoreAccount {
  readonly accountId: string;
  readonly accountName: string;
  /** Provider status, preserved without assuming a fixed set of values. */
  readonly status: string;
  readonly creditBalance: number;
}

/**
 * Unmodified provider fields. Semaphore does not document a reliable transaction
 * record schema; narrow individual values before using them.
 */
export type SemaphoreAccountTransaction = Readonly<Record<string, unknown>>;

export interface SemaphoreSenderName {
  readonly name: string;
  readonly status: string;
  /** Provider timestamp, or null when absent/null. No timezone is inferred. */
  readonly createdAt: string | null;
}

export interface SemaphoreAccountUser {
  readonly userId: string;
  readonly email: string;
  readonly role: string;
  /** Provider status, or null when absent/null in the response. */
  readonly status: string | null;
}

/** One page only. The provider defaults to page 1 and limit 100 (maximum 1,000). */
export type ListAccountItemsInput = PaginationInput;

export interface AccountTransactionsResource {
  list(
    input?: ListAccountItemsInput,
    options?: RequestOptions,
  ): Promise<ApiResponse<SemaphoreAccountTransaction[]>>;
}

export interface AccountSenderNamesResource {
  list(
    input?: ListAccountItemsInput,
    options?: RequestOptions,
  ): Promise<ApiResponse<SemaphoreSenderName[]>>;
}

export interface AccountUsersResource {
  list(
    input?: ListAccountItemsInput,
    options?: RequestOptions,
  ): Promise<ApiResponse<SemaphoreAccountUser[]>>;
}

export interface AccountResource {
  get(options?: RequestOptions): Promise<ApiResponse<SemaphoreAccount>>;
  readonly transactions: AccountTransactionsResource;
  readonly senderNames: AccountSenderNamesResource;
  readonly users: AccountUsersResource;
}
