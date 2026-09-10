import type { RequestExecutor } from "../../core/request.js";
import { createMessagesResource } from "../messages/resource.js";
import type { PriorityResource } from "./types.js";

export function createPriorityResource(
  request: RequestExecutor,
  defaultSender: string | undefined,
): PriorityResource {
  return createMessagesResource(request, defaultSender, "priority");
}
