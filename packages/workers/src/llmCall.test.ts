import { describe, expect, it } from "vitest";
import { createFakeProvider } from "@workflow/provider";
import { createLlmCallWorker } from "./llmCall";

describe("createLlmCallWorker", () => {
  it("sends prompt plus parent outputs and returns provider fields", async () => {
    const provider = createFakeProvider({
      text: (request) => request.messages[0]?.content ?? "",
    });
    const worker = createLlmCallWorker(provider);
    const output = await worker({
      config: { prompt: "Summarize this.", model: "gemini-2.5-flash" },
      inputs: { "fetch-yc-news": { url: "https://news.ycombinator.com/" } },
    });

    expect(output["model"]).toBe("gemini-2.5-flash");
    expect(String(output["text"])).toContain("Summarize this.");
    expect(String(output["text"])).toContain("fetch-yc-news");
  });

  it("throws when prompt is missing", async () => {
    const worker = createLlmCallWorker(createFakeProvider());
    await expect(worker({ config: {}, inputs: {} })).rejects.toThrow(
      "config.prompt",
    );
  });
});
