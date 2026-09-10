import { mapMessage } from "../messages/mapper.js";
import type { WireOtpMessage } from "./schema.js";
import type { SemaphoreOtp } from "./types.js";

export function mapOtpMessage(record: WireOtpMessage): SemaphoreOtp {
  return {
    ...mapMessage(record),
    code: String(record.code),
  };
}

export function mapOtpMessages(
  records: readonly WireOtpMessage[],
): SemaphoreOtp[] {
  return records.map(mapOtpMessage);
}
