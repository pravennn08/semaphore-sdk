import { resolveClientConfig, type SemaphoreClientOptions } from "./config.js";
import { createRequestExecutor } from "./core/request.js";
import { createMessagesResource } from "./resource/messages/resource.js";
import type { MessagesResource } from "./resource/messages/types.js";
import { createOtpResource } from "./resource/otp/resource.js";
import type { OtpResource } from "./resource/otp/types.js";

export class SemaphoreClient {
  readonly messages: MessagesResource;
  readonly otp: OtpResource;

  constructor(options: SemaphoreClientOptions) {
    const config = resolveClientConfig(options);
    const request = createRequestExecutor(config);
    this.messages = createMessagesResource(request, config.defaultSender);
    this.otp = createOtpResource(request, config.defaultSender);
  }
}
