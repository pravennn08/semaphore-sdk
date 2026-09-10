import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const fixtureDirectory = mkdtempSync(join(tmpdir(), "semaphore-sdk-consumer-"));
const packageManager = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const typeScript = join(
  projectRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tsc.cmd" : "tsc",
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

  const tarball = join(fixtureDirectory, "semaphore-sdk-0.1.0.tgz");
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

const transport = async () =>
  new Response(
    JSON.stringify([
      {
        message_id: "consumer-test-id",
        recipient: "639171234567",
        status: "Queued",
      },
    ]),
    { status: 200, headers: { "content-type": "application/json" } },
  );

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
`,
  );
  writeFileSync(
    join(fixtureDirectory, "index.ts"),
    `import { SemaphoreClient } from "semaphore-sdk";
import type {
  HttpTransport,
  SemaphoreMessage,
  SemaphoreOtp,
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
void messages;
void otpMessages;
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
    ["install", "--ignore-scripts", "--lockfile=false"],
    fixtureDirectory,
  );
  run(process.execPath, ["index.mjs"], fixtureDirectory);
  run(
    typeScript,
    ["--project", "tsconfig.json", "--pretty", "false"],
    fixtureDirectory,
  );
  console.log("Package consumer verification passed.");
} finally {
  rmSync(fixtureDirectory, { recursive: true, force: true });
}
