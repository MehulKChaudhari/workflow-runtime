import type { CompleteRequest, CompleteResult, Message, Provider } from "./types";

const DEFAULT_MODEL = "gemini-2.5-flash";
const MAX_TRANSPORT_ATTEMPTS = 3;

export interface GeminiProviderOptions {
  apiKey: string;
  defaultModel?: string;
  /** Injected in tests so we never hit the network. */
  fetch?: typeof fetch;
}

export function createGeminiProvider(
  options: GeminiProviderOptions,
): Provider {
  const fetchFn = options.fetch ?? fetch;
  const defaultModel = options.defaultModel ?? DEFAULT_MODEL;

  return {
    async complete(request: CompleteRequest): Promise<CompleteResult> {
      const model = request.model ?? defaultModel;
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/` +
        `${encodeURIComponent(model)}:generateContent`;

      let lastError: unknown;
      for (let attempt = 1; attempt <= MAX_TRANSPORT_ATTEMPTS; attempt++) {
        try {
          const response = await fetchFn(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": options.apiKey,
            },
            body: JSON.stringify(toGeminiBody(request.messages)),
            signal: AbortSignal.timeout(30_000),
          });

          if (response.status === 429 || response.status >= 500) {
            lastError = new Error(
              `gemini ${response.status}: ${await response.text()}`,
            );
            if (attempt === MAX_TRANSPORT_ATTEMPTS) throw lastError;
            await wait(1000 * 2 ** (attempt - 1));
            continue;
          }

          if (!response.ok) {
            throw new Error(
              `gemini ${response.status}: ${await response.text()}`,
            );
          }

          return fromGeminiResponse(await response.json(), model);
        } catch (error) {
          if (error instanceof Error && error.name === "TimeoutError") {
            lastError = error;
            if (attempt === MAX_TRANSPORT_ATTEMPTS) {
              throw new Error("gemini request timed out");
            }
            await wait(1000 * 2 ** (attempt - 1));
            continue;
          }
          throw error;
        }
      }
      throw lastError instanceof Error
        ? lastError
        : new Error("gemini request failed");
    },
  };
}

export function createGeminiProviderFromEnv(): Provider {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (apiKey === undefined || apiKey === "") {
    throw new Error("GEMINI_API_KEY is not set");
  }
  return createGeminiProvider({ apiKey });
}

/** Gemini uses `model` where we say `assistant`; system is a separate field. */
export function toGeminiBody(messages: Message[]): Record<string, unknown> {
  const systemParts = messages
    .filter((message) => message.role === "system")
    .map((message) => ({ text: message.content }));
  const contents = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));
  return {
    ...(systemParts.length > 0
      ? { systemInstruction: { parts: systemParts } }
      : {}),
    contents,
  };
}

function fromGeminiResponse(body: unknown, model: string): CompleteResult {
  if (typeof body !== "object" || body === null) {
    throw new Error("gemini returned a non-object body");
  }
  const record = body as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
    };
  };
  const text = record.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("");
  if (text === undefined || text === "") {
    throw new Error("gemini returned no text");
  }
  return {
    text,
    model,
    inputTokens: record.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: record.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
