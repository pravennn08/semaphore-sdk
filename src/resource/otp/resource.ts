import type { RequestExecutor, RequestOptions } from "../../core/request.js";
import { mapOtpMessages } from "./mapper.js";
import { parseWireOtpMessages, validateSendOtpInput } from "./schema.js";
import type { OtpResource, SendOtpInput } from "./types.js";

export function createOtpResource(
  request: RequestExecutor,
  defaultSender: string | undefined,
): OtpResource {
  return {
    async send(input: SendOtpInput, options?: RequestOptions) {
      const validated = validateSendOtpInput(input);
      const senderName = validated.senderName ?? defaultSender;
      const form: Record<string, string> = {
        number: validated.recipient,
        message: validated.message,
      };
      if (senderName !== undefined) {
        form.sendername = senderName;
      }
      if (validated.code !== undefined) {
        form.code = validated.code;
      }

      return request(
        {
          path: "otp",
          form,
          parse: (payload) => mapOtpMessages(parseWireOtpMessages(payload)),
        },
        options,
      );
    },
  };
}
