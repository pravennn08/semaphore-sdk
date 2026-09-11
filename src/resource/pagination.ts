import { SemaphoreValidationError } from "../errors.js";

export interface PaginationInput {
  readonly page?: number;
  readonly limit?: number;
}

export function validatePagination(
  input: PaginationInput,
): Record<string, string> {
  const query: Record<string, string> = {};
  for (const name of ["page", "limit"] as const) {
    const value = input[name];
    if (value === undefined) {
      continue;
    }
    if (
      !Number.isSafeInteger(value) ||
      value < 1 ||
      (name === "limit" && value > 1_000)
    ) {
      const range = name === "limit" ? "between 1 and 1000" : "at least 1";
      throw new SemaphoreValidationError(
        `${name} must be an integer ${range}.`,
      );
    }
    query[name] = String(value);
  }
  return query;
}
