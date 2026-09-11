import type { RequestExecutor, RequestOptions } from "../../core/request.js";
import { mapAccount, mapAccountUsers, mapSenderNames } from "./mapper.js";
import {
  parseTransactions,
  parseWireAccount,
  parseWireAccountUsers,
  parseWireSenderNames,
  validateListAccountInput,
} from "./schema.js";
import type { AccountResource, ListAccountItemsInput } from "./types.js";

function createListResource<T>(
  request: RequestExecutor,
  path: string,
  parse: (payload: unknown) => T[],
) {
  return {
    async list(input?: ListAccountItemsInput, options?: RequestOptions) {
      const query = validateListAccountInput(input);
      return request({ method: "GET", path, query, parse }, options);
    },
  };
}

export function createAccountResource(
  request: RequestExecutor,
): AccountResource {
  return {
    get(options?: RequestOptions) {
      return request(
        {
          method: "GET",
          path: "account",
          parse: (payload) => mapAccount(parseWireAccount(payload)),
        },
        options,
      );
    },
    transactions: createListResource(
      request,
      "account/transactions",
      parseTransactions,
    ),
    senderNames: createListResource(request, "account/sendernames", (payload) =>
      mapSenderNames(parseWireSenderNames(payload)),
    ),
    users: createListResource(request, "account/users", (payload) =>
      mapAccountUsers(parseWireAccountUsers(payload)),
    ),
  };
}
