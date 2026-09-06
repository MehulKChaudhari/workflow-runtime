/**
 * @workflow/provider — one interface over "which LLM". Everything above
 * this package talks to the interface, never to a vendor SDK directly.
 */
export type {
  Message,
  MessageRole,
  CompleteRequest,
  CompleteResult,
  Provider,
} from "./types";
export { createFakeProvider, type FakeProviderOptions } from "./fake";
export {
  createGeminiProvider,
  createGeminiProviderFromEnv,
  toGeminiBody,
  type GeminiProviderOptions,
} from "./gemini";
