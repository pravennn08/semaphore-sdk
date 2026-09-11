import type { WireAccount, WireAccountUser, WireSenderName } from "./schema.js";
import type {
  SemaphoreAccount,
  SemaphoreAccountUser,
  SemaphoreSenderName,
} from "./types.js";

export function mapAccount(value: WireAccount): SemaphoreAccount {
  return {
    accountId: String(value.account_id),
    accountName: value.account_name,
    status: value.status,
    creditBalance: value.credit_balance,
  };
}

export function mapSenderNames(
  values: WireSenderName[],
): SemaphoreSenderName[] {
  return values.map((value) => ({
    name: value.name,
    status: value.status,
    createdAt: value.created_at,
  }));
}

export function mapAccountUsers(
  values: WireAccountUser[],
): SemaphoreAccountUser[] {
  return values.map((value) => ({
    userId: String(value.user_id),
    email: value.email,
    role: value.role,
    status: value.status,
  }));
}
