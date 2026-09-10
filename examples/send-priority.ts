import { SemaphoreClient } from "semaphore-sdk";

const apiKey = process.env.SEMAPHORE_API_KEY?.trim();
const recipient = process.env.SEMAPHORE_RECIPIENT?.trim();

if (!apiKey || !recipient) {
  throw new Error(
    "Set SEMAPHORE_API_KEY and SEMAPHORE_RECIPIENT before running this example.",
  );
}
if (process.env.SEMAPHORE_ALLOW_LIVE_SMS !== "true") {
  throw new Error(
    "This example sends a real SMS. Set SEMAPHORE_ALLOW_LIVE_SMS=true to continue.",
  );
}

const client = new SemaphoreClient({
  apiKey,
  defaultSender: process.env.SEMAPHORE_SENDER_NAME?.trim(),
});

const result = await client.priority.send({
  to: recipient,
  message: "This is a priority SMS sent with semaphore-sdk.",
});

console.log(result.data[0]);
