import { afterEach, describe, expect, it, vi } from "vitest";
import { httpFetchWorker, httpPostWorker } from "./http";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("httpFetchWorker", () => {
  it("returns status and body on 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("hello", { status: 200 })),
    );
    const output = await httpFetchWorker({
      config: { url: "https://news.ycombinator.com/" },
      inputs: {},
    });
    expect(output).toMatchObject({
      status: 200,
      url: "https://news.ycombinator.com/",
      body: "hello",
    });
  });

  it("rejects non-http URLs", async () => {
    await expect(
      httpFetchWorker({ config: { url: "file:///etc/passwd" }, inputs: {} }),
    ).rejects.toThrow("http and https");
  });

  it("throws on HTTP error status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 503 })),
    );
    await expect(
      httpFetchWorker({
        config: { url: "https://example.com/fail" },
        inputs: {},
      }),
    ).rejects.toThrow("503");
  });
});

describe("httpPostWorker", () => {
  it("POSTs JSON and returns the response body", async () => {
    let method = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        method = init?.method ?? "";
        return new Response("saved", { status: 201 });
      }),
    );
    const output = await httpPostWorker({
      config: {
        url: "https://api.example.com/digests",
        body: { channel: "morning-brief" },
      },
      inputs: {},
    });
    expect(output["status"]).toBe(201);
    expect(method).toBe("POST");
  });
});
