import type { ApiResponse, RequestOptions } from "../../core/request.js";
import type { SemaphoreMessage, SendSmsInput } from "../messages/types.js";

export type SendPriorityInput = SendSmsInput;

export interface PriorityResource {
  send(
    input: SendPriorityInput,
    options?: RequestOptions,
  ): Promise<ApiResponse<SemaphoreMessage[]>>;
}
