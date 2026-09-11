import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Unknown keys may themselves contain personal data, so only known field names
// are printed. Values, URLs, credentials, and raw response bodies are never logged.
const knownFields = new Set([
  "data",
  "items",
  "results",
  "users",
  "sendernames",
  "senderNames",
  "sender_names",
  "id",
  "user_id",
  "account_id",
  "account_name",
  "name",
  "sender_name",
  "sendername",
  "sender_name_id",
  "email",
  "role",
  "status",
  "created_at",
  "updated_at",
  "createdAt",
  "user",
  "account",
  "pivot",
  "meta",
  "links",
  "total",
  "current_page",
  "last_page",
  "per_page",
  "from",
  "to",
  "error",
  "errors",
  "message",
  "success",
  "code",
]);

export function describeResponseShape(value, depth = 0) {
  if (value === null) return "null";
  if (typeof value === "string")
    return value.trim() === "" ? "blank_string" : "string";
  if (typeof value !== "object") return typeof value;
  if (depth >= 5) return Array.isArray(value) ? "array" : "object";
  if (Array.isArray(value)) {
    return {
      type: "array",
      length: value.length,
      items: value
        .slice(0, 5)
        .map((item) => describeResponseShape(item, depth + 1)),
    };
  }
  return {
    type: "object",
    fields: Object.fromEntries(
      Object.entries(value)
        .slice(0, 40)
        .map(([key, item], index) => [
          knownFields.has(key) ? key : `[unrecognized field ${index + 1}]`,
          describeResponseShape(item, depth + 1),
        ]),
    ),
  };
}

function numberHeader(response, name) {
  const raw = response.headers.get(name);
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export async function inspectAccountResponse(
  resource,
  apiKey,
  transport = fetch,
) {
  if (resource !== "senderNames" && resource !== "users") {
    throw new Error("Choose senderNames or users.");
  }
  if (typeof apiKey !== "string" || apiKey.trim() === "") {
    throw new Error("Set SEMAPHORE_API_KEY before running this diagnostic.");
  }
  const path = resource === "senderNames" ? "sendernames" : "users";
  const url = new URL(`https://api.semaphore.co/api/v4/account/${path}`);
  url.search = new URLSearchParams({
    apikey: apiKey.trim(),
    page: "1",
    limit: "5",
  }).toString();
  const response = await transport(url, {
    method: "GET",
    headers: { accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.text();
  let bodyFormat = "json";
  let shape;
  try {
    shape = describeResponseShape(JSON.parse(body));
  } catch {
    bodyFormat = "not_json";
    shape = "body omitted";
  }
  return {
    resource,
    statusCode: response.status,
    rateLimit: {
      limit: numberHeader(response, "x-ratelimit-limit"),
      remaining: numberHeader(response, "x-ratelimit-remaining"),
      retryAfterSeconds: numberHeader(response, "retry-after"),
    },
    bodyFormat,
    shape,
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const diagnostic = await inspectAccountResponse(
      process.argv[2],
      process.env.SEMAPHORE_API_KEY,
    );
    console.log(JSON.stringify(diagnostic, null, 2));
    if (diagnostic.statusCode >= 400) process.exitCode = 1;
  } catch {
    console.error(
      "Diagnostic failed. Check SEMAPHORE_API_KEY, your connection, and the argument (senderNames or users). Error details are omitted to avoid exposing credentials.",
    );
    process.exitCode = 1;
  }
}
