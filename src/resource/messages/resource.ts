import type { RequestExecutor, RequestOptions } from "../../core/request.js";
import { mapMessages } from "./mapper.js";
import {
  parseWireMessage,
  parseWireMessages,
  validateListMessagesInput,
  validateMessageId,
  validateSendInput,
} from "./schema.js";
import type {
  ListMessagesInput,
  MessagesResource,
  SendSmsInput,
} from "./types.js";

export function createMessagesResource(
  request: RequestExecutor,
  defaultSender: string | undefined,
  path = "messages",
): MessagesResource {
  return {
    async send(input: SendSmsInput, options?: RequestOptions) {
      const validated = validateSendInput(input);
      const senderName = validated.senderName ?? defaultSender;
      const form: Record<string, string> = {
        number: validated.recipients.join(","),
        message: validated.message,
      };
      if (senderName !== undefined) {
        form.sendername = senderName;
      }

      return request(
        {
          path,
          form,
          parse: (payload) => mapMessages(parseWireMessages(payload)),
        },
        options,
      );
    },
    async list(input?: ListMessagesInput, options?: RequestOptions) {
      const validated = validateListMessagesInput(input);
      return request(
        {
          method: "GET",
          path: "messages",
          query: validated.query,
          parse: (payload) =>
            mapMessages(parseWireMessages(payload, { allowEmpty: true })),
        },
        options,
      );
    },
    async get(messageId: string | number, options?: RequestOptions) {
      const validatedMessageId = validateMessageId(messageId);
      return request(
        {
          method: "GET",
          path: `messages/${encodeURIComponent(validatedMessageId)}`,
          parse: (payload) => mapMessages([parseWireMessage(payload)])[0],
        },
        options,
      );
    },
  };
}
