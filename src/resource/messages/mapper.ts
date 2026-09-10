import type { SemaphoreMessage, SemaphoreMessageStatus } from "./types.js";
import type { WireMessage } from "./schema.js";

function publicStatus(rawStatus: string): SemaphoreMessageStatus {
  const normalized = rawStatus.toLowerCase();
  if (
    normalized === "queued" ||
    normalized === "pending" ||
    normalized === "sent" ||
    normalized === "failed" ||
    normalized === "refunded"
  ) {
    return normalized;
  }
  return "unknown";
}

export function mapMessage(record: WireMessage): SemaphoreMessage {
  return {
    messageId: String(record.message_id),
    recipient: record.recipient,
    senderName: record.sender_name ?? null,
    status: publicStatus(record.status),
    rawStatus: record.status,
  };
}

export function mapMessages(
  records: readonly WireMessage[],
): SemaphoreMessage[] {
  return records.map(mapMessage);
}
