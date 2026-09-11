import { SemaphoreClient } from "semaphore-sdk";

const apiKey = process.env.SEMAPHORE_API_KEY?.trim();
if (!apiKey) {
  throw new Error("Set SEMAPHORE_API_KEY before running this example.");
}

const client = new SemaphoreClient({ apiKey });

// One endpoint per run. Wait at least 60 seconds between initial live checks.
async function readSelectedResource() {
  switch (process.argv[2] ?? "account") {
    case "account":
      return client.account.get();
    case "transactions":
      return client.account.transactions.list({ page: 1, limit: 5 });
    case "senderNames":
      return client.account.senderNames.list({ page: 1, limit: 5 });
    case "users":
      return client.account.users.list({ page: 1, limit: 5 });
    default:
      throw new Error("Choose account, transactions, senderNames, or users.");
  }
}

console.log(await readSelectedResource());
