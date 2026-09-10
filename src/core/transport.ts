export type HttpTransport = typeof globalThis.fetch;

export const defaultTransport: HttpTransport = (input, init) =>
  globalThis.fetch(input, init);
