import type { CompleteRequest, CompleteResult, Provider } from "./types";

export interface FakeProviderOptions {
  text?: string | ((request: CompleteRequest) => string);
}

/** No network. Used by tests and local runs without a key. */
export function createFakeProvider(
  options: FakeProviderOptions = {},
): Provider {
  return {
    async complete(request: CompleteRequest): Promise<CompleteResult> {
      const text =
        typeof options.text === "function"
          ? options.text(request)
          : (options.text ?? "ok");
      return {
        text,
        model: request.model ?? "fake",
        inputTokens: 0,
        outputTokens: 0,
      };
    },
  };
}
