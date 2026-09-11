import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const packageVersion = JSON.parse(
  readFileSync(join(projectRoot, "package.json"), "utf8"),
).version;
const fixtureDirectory = mkdtempSync(join(tmpdir(), "semaphore-sdk-consumer-"));
const packageManager = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const typeScript = join(
  projectRoot,
  "node_modules",
  "typescript",
  "bin",
  "tsc",
);

function run(command, args, cwd) {
  execFileSync(command, args, {
    cwd,
    stdio: "inherit",
    shell:
      process.platform === "win32" && command.toLowerCase().endsWith(".cmd"),
    windowsHide: true,
  });
}

try {
  run(
    packageManager,
    ["pack", "--pack-destination", fixtureDirectory],
    projectRoot,
  );

  const tarball = join(fixtureDirectory, `semaphore-sdk-${packageVersion}.tgz`);
  writeFileSync(
    join(fixtureDirectory, "package.json"),
    `${JSON.stringify(
      {
        name: "semaphore-sdk-consumer-fixture",
        private: true,
        type: "module",
        dependencies: {
          "semaphore-sdk": `file:${tarball.replaceAll("\\", "/")}`,
        },
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(fixtureDirectory, "index.mjs"),
    `import { SemaphoreClient } from "semaphore-sdk";

const transport = async (url) => {
  const path = new URL(url).pathname;
  const accountResponses = {
    "/api/v4/account": { account_id: 42, account_name: "Consumer Fixture", status: "Active", credit_balance: "12.50" },
    "/api/v4/account/transactions": [{ example_provider_field: "preserved" }],
    "/api/v4/account/sendernames": [{ name: "ExampleSMS", status: "Active", created_at: "2026-01-01 10:00:00" }, { name: "ExampleAlerts", status: "Active", additional_provider_field: "placeholder" }],
    "/api/v4/account/users": [{ user_id: 7, email: "owner@example.com", role: "Owner", status: "Active" }, { user_id: 8, email: "member@example.com", role: "Member" }],
  };
  if (Object.hasOwn(accountResponses, path)) {
    return new Response(JSON.stringify(accountResponses[path]), { status: 200 });
  }
  return new Response(
    JSON.stringify([
      {
        message_id: "consumer-test-id",
        recipient: "639171234567",
        status: "Queued",
      },
    ]),
    { status: 200, headers: { "content-type": "application/json" } },
  );
};

const client = new SemaphoreClient({
  apiKey: "consumer-test-key",
  transport,
});
const result = await client.messages.send({
  to: "0917 123 4567",
  message: "Consumer fixture",
});

if (result.data[0]?.messageId !== "consumer-test-id") {
  throw new Error("The packed SDK returned an unexpected message id.");
}

const listed = await client.messages.list({ page: 1, limit: 1 });
if (listed.data[0]?.messageId !== "consumer-test-id") {
  throw new Error("The packed SDK returned an unexpected list result.");
}

const retrieved = await client.messages.get("consumer-test-id");
if (retrieved.data.messageId !== "consumer-test-id") {
  throw new Error("The packed SDK returned an unexpected retrieval result.");
}

const account = await client.account.get();
const transactions = await client.account.transactions.list({ page: 1, limit: 10 });
const senderNames = await client.account.senderNames.list();
const users = await client.account.users.list();
if (account.data.accountId !== "42" || account.data.creditBalance !== 12.5) {
  throw new Error("The packed SDK returned an unexpected account.");
}
if (transactions.data[0]?.example_provider_field !== "preserved") {
  throw new Error("The packed SDK lost transaction fields.");
}
if (senderNames.data[0]?.createdAt !== "2026-01-01 10:00:00" || users.data[0]?.userId !== "7") {
  throw new Error("The packed SDK returned unexpected account list records.");
}
if (senderNames.data[1]?.createdAt !== null || users.data[1]?.status !== null) {
  throw new Error("The packed SDK did not normalize omitted account metadata to null.");
}
`,
  );
  writeFileSync(
    join(fixtureDirectory, "index.ts"),
    `import { SemaphoreClient } from "semaphore-sdk";
import type {
  AccountResource,
  AccountTransactionsResource,
  AccountSenderNamesResource,
  AccountUsersResource,
  ApiResponse,
  HttpTransport,
  ListAccountItemsInput,
  ListMessagesInput,
  PriorityResource,
  SemaphoreAccount,
  SemaphoreAccountTransaction,
  SemaphoreSenderName,
  SemaphoreAccountUser,
  SemaphoreMessage,
  SemaphoreOtp,
  SendPriorityInput,
  SendOtpInput,
} from "semaphore-sdk";

const transport: HttpTransport = async () =>
  new Response(JSON.stringify([]), { status: 200 });
const client = new SemaphoreClient({ apiKey: "type-test-key", transport });
const send = client.messages.send({
  to: ["639171234567"],
  message: "Type test",
});
const messages: Promise<Readonly<{ data: SemaphoreMessage[] }>> = send;
const otpInput: SendOtpInput = {
  to: "639171234567",
  message: "Use {otp}",
};
const otp = client.otp.send(otpInput);
const otpMessages: Promise<Readonly<{ data: SemaphoreOtp[] }>> = otp;
const priorityInput: SendPriorityInput = {
  to: "639171234567",
  message: "Priority type test",
};
const priority: Promise<Readonly<{ data: SemaphoreMessage[] }>> =
  client.priority.send(priorityInput);
const priorityResource: PriorityResource = client.priority;
const retrievalInput: ListMessagesInput = {
  page: 1,
  limit: 10,
  status: "success",
};
const listedMessages: Promise<Readonly<{ data: SemaphoreMessage[] }>> =
  client.messages.list(retrievalInput);
const retrievedMessage: Promise<Readonly<{ data: SemaphoreMessage }>> =
  client.messages.get("message-id");
void messages;
void otpMessages;
void priority;
void priorityResource;
void listedMessages;
void retrievedMessage;

const accountResource: AccountResource = client.account;
const transactionResource: AccountTransactionsResource = client.account.transactions;
const senderResource: AccountSenderNamesResource = client.account.senderNames;
const userResource: AccountUsersResource = client.account.users;
const pagination: ListAccountItemsInput = { page: 1, limit: 10 };
const account: Promise<ApiResponse<SemaphoreAccount>> = accountResource.get({ timeoutMs: 1000 });
const transactions: Promise<ApiResponse<SemaphoreAccountTransaction[]>> = transactionResource.list(pagination);
const senderNames: Promise<ApiResponse<SemaphoreSenderName[]>> = senderResource.list(pagination);
const users: Promise<ApiResponse<SemaphoreAccountUser[]>> = userResource.list(undefined, { signal: new AbortController().signal });
void account;
void senderNames;
void users;
const senderWithoutDate: SemaphoreSenderName = { name: "ExampleSMS", status: "Active", createdAt: null };
const userWithoutStatus: SemaphoreAccountUser = { userId: "8", email: "member@example.com", role: "Member", status: null };
void senderWithoutDate;
void userWithoutStatus;
function checkNullableMetadata(sender: SemaphoreSenderName, user: SemaphoreAccountUser) {
  // @ts-expect-error Callers must handle a missing sender timestamp.
  const date: string = sender.createdAt;
  // @ts-expect-error Callers must handle a missing user status.
  const status: string = user.status;
  void date;
  void status;
}
void checkNullableMetadata;
async function checkTransactionTypes() {
  const result = await transactions;
  // @ts-expect-error Undocumented transaction fields must be narrowed by callers.
  const unsafe: string = result.data[0].example_provider_field;
  void unsafe;
}
void checkTransactionTypes;
`,
  );
  writeFileSync(
    join(fixtureDirectory, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          noEmit: true,
          skipLibCheck: true,
        },
        include: ["index.ts"],
      },
      null,
      2,
    )}\n`,
  );

  run(
    packageManager,
    ["install", "--ignore-scripts", "--lockfile=false", "--force"],
    fixtureDirectory,
  );
  run(process.execPath, ["index.mjs"], fixtureDirectory);
  run(
    process.execPath,
    [typeScript, "--project", "tsconfig.json", "--pretty", "false"],
    fixtureDirectory,
  );
  console.log("Package consumer verification passed.");
} finally {
  rmSync(fixtureDirectory, { recursive: true, force: true });
}
