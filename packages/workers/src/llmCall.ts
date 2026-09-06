import type { Provider } from "@workflow/provider";
import type { JsonObject, JsonValue } from "@workflow/shared";
import type { Worker } from "./worker";

/**
 * Calls the provider with config.prompt plus parent outputs as context.
 * Model comes from config.model when set; otherwise the provider default.
 * API keys never come from config — they live on the provider.
 */
export function createLlmCallWorker(provider: Provider): Worker {
  return async ({ config, inputs }) => {
    const prompt = asString(config["prompt"]);
    if (prompt === undefined || prompt === "") {
      throw new Error('llm-call config.prompt must be a non-empty string');
    }
    const model = asString(config["model"]);
    const result = await provider.complete({
      messages: [
        { role: "user", content: buildUserContent(prompt, inputs) },
      ],
      ...(model !== undefined ? { model } : {}),
    });
    return {
      text: result.text,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    };
  };
}

function buildUserContent(
  prompt: string,
  inputs: Record<string, JsonObject>,
): string {
  const parentIds = Object.keys(inputs);
  if (parentIds.length === 0) return prompt;
  return `${prompt}\n\nContext from parent nodes:\n${JSON.stringify(inputs)}`;
}

function asString(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}
