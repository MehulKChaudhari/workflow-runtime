import type { JsonObject, JsonValue } from "@workflow/shared";
import type { Worker } from "./worker";

const MAX_BODY_CHARS = 20_000;

function requireUrl(config: JsonObject): string {
  const url = config["url"];
  if (typeof url !== "string" || url === "") {
    throw new Error("http worker config.url must be a non-empty string");
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`http worker config.url is not a valid URL: ${url}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("http worker only allows http and https URLs");
  }
  return url;
}

function headerRecord(value: JsonValue | undefined): Record<string, string> {
  if (value === undefined || typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  const headers: Record<string, string> = {};
  for (const [key, headerValue] of Object.entries(value)) {
    if (typeof headerValue === "string") headers[key] = headerValue;
  }
  return headers;
}

function clip(text: string): string {
  if (text.length <= MAX_BODY_CHARS) return text;
  return `${text.slice(0, MAX_BODY_CHARS)}…`;
}

export const httpFetchWorker: Worker = async ({ config }) => {
  const url = requireUrl(config);
  const method =
    typeof config["method"] === "string" ? config["method"] : "GET";
  const response = await fetch(url, {
    method,
    headers: headerRecord(config["headers"]),
    signal: AbortSignal.timeout(15_000),
  });
  const body = clip(await response.text());
  if (!response.ok) {
    throw new Error(`http-fetch ${response.status} ${url}: ${body}`);
  }
  return { status: response.status, url, body };
};

export const httpPostWorker: Worker = async ({ config }) => {
  const url = requireUrl(config);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headerRecord(config["headers"]),
    },
    body: JSON.stringify(config["body"] ?? {}),
    signal: AbortSignal.timeout(15_000),
  });
  const body = clip(await response.text());
  if (!response.ok) {
    throw new Error(`http-post ${response.status} ${url}: ${body}`);
  }
  return { status: response.status, url, body };
};
