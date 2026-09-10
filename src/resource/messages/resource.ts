import type { RequestExecutor, RequestOptions } from "../../core/request.js";
import { mapMessages } from "./mapper.js";
import { parseWireMessages, validateSendInput } from "./schema.js";
import type { MessagesResource, SendSmsInput } from "./types.js";

export function createMessagesResource(
  request: RequestExecutor,
  defaultSender: string | undefined,
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
          path: "messages",
          form,
          parse: (payload) => mapMessages(parseWireMessages(payload)),
        },
        options,
      );
    },
  };
}
