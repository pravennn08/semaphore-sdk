import type { ApiResponse, RequestOptions } from "../../core/request.js";
import type {
  SemaphoreMessageStatus,
  SemaphoreMessage,
  SendSmsInput,
} from "../messages/types.js";

export interface SendOtpInput extends Omit<SendSmsInput, "to"> {
  /** OTP sends are intentionally limited to one recipient. */
  readonly to: string;
  /** A provider-generated code is used when this is omitted. */
  readonly code?: string | number;
}

export interface SemaphoreOtp extends Omit<SemaphoreMessage, "status"> {
  readonly status: SemaphoreMessageStatus;
  readonly code: string;
}

export interface OtpResource {
  send(
    input: SendOtpInput,
    options?: RequestOptions,
  ): Promise<ApiResponse<SemaphoreOtp[]>>;
}
