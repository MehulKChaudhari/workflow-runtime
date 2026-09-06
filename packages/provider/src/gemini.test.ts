import { describe, expect, it, vi } from "vitest";
import { createFakeProvider } from "./fake";
import { createGeminiProvider, toGeminiBody } from "./gemini";

describe("toGeminiBody", () => {
  it("maps system to systemInstruction and assistant to model", () => {
    expect(
      toGeminiBody([
        { role: "system", content: "be brief" },
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
      ]),
    ).toEqual({
      systemInstruction: { parts: [{ text: "be brief" }] },
      contents: [
        { role: "user", parts: [{ text: "hi" }] },
        { role: "model", parts: [{ text: "hello" }] },
      ],
    });
  });
});

describe("createFakeProvider", () => {
  it("returns the configured text without calling the network", async () => {
    const provider = createFakeProvider({ text: "digest" });
    const result = await provider.complete({
      messages: [{ role: "user", content: "hi" }],
    });
    expect(result).toEqual({
      text: "digest",
      model: "fake",
      inputTokens: 0,
      outputTokens: 0,
    });
  });
});

describe("createGeminiProvider", () => {
  it("uses config/request model over the default and parses usage", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "ok" }] } }],
          usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 2 },
        }),
        { status: 200 },
      ),
    );

    const provider = createGeminiProvider({
      apiKey: "test-key",
      fetch: fetchMock,
    });
    const result = await provider.complete({
      messages: [{ role: "user", content: "hi" }],
      model: "gemini-2.5-flash-lite",
    });

    expect(result).toEqual({
      text: "ok",
      model: "gemini-2.5-flash-lite",
      inputTokens: 4,
      outputTokens: 2,
    });
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("gemini-2.5-flash-lite");
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      "x-goog-api-key": "test-key",
    });
  });

  it("retries 429 then succeeds", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("slow down", { status: 429 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: "done" }] } }],
          }),
          { status: 200 },
        ),
      );

    const provider = createGeminiProvider({
      apiKey: "test-key",
      fetch: fetchMock,
    });

    vi.useFakeTimers();
    const pending = provider.complete({
      messages: [{ role: "user", content: "hi" }],
    });
    await vi.runAllTimersAsync();
    const result = await pending;
    vi.useRealTimers();

    expect(result.text).toBe("done");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
