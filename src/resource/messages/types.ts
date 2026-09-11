import type {
  ApiResponse,
  RequestExecutor,
  RequestOptions,
} from "../../core/request.js";

export type SemaphoreMessageStatus =
  "queued" | "pending" | "sent" | "success" | "failed" | "refunded" | "unknown";

export interface SemaphoreMessage {
  readonly messageId: string;
  readonly recipient: string;
  readonly senderName: string | null;
  readonly status: SemaphoreMessageStatus;
  readonly rawStatus: string;
}

export interface SendSmsInput {
  readonly to: string | readonly string[];
  readonly message: string;
  readonly senderName?: string;
}

export interface ListMessagesInput {
  readonly limit?: number;
  readonly page?: number;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly network?: string;
  readonly status?: string;
}

export interface MessagesResource {
  send(
    input: SendSmsInput,
    options?: RequestOptions,
  ): Promise<ApiResponse<SemaphoreMessage[]>>;
  list(
    input?: ListMessagesInput,
    options?: RequestOptions,
  ): Promise<ApiResponse<SemaphoreMessage[]>>;
  get(
    messageId: string | number,
    options?: RequestOptions,
  ): Promise<ApiResponse<SemaphoreMessage>>;
}

export type MessagesRequestExecutor = RequestExecutor;
