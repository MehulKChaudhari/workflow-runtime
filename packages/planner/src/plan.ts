import {
  parseWorkflowDefinition,
  type ParseWorkflowResult,
  type ValidationIssue,
} from "@workflow/graph";
import type { Message, Provider } from "@workflow/provider";

export const DEFAULT_NODE_TYPES = [
  "echo",
  "llm-call",
  "http-fetch",
  "http-post",
] as const;

/** First try plus two repairs — enough for id typos, not an infinite loop. */
const DEFAULT_MAX_ATTEMPTS = 3;

export interface PlanWorkflowOptions {
  goal: string;
  provider: Provider;
  allowedTypes?: readonly string[];
  maxAttempts?: number;
}

export async function planWorkflow(
  options: PlanWorkflowOptions,
): Promise<ParseWorkflowResult> {
  const allowedTypes = options.allowedTypes ?? DEFAULT_NODE_TYPES;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const messages: Message[] = [
    { role: "system", content: systemPrompt(allowedTypes) },
    { role: "user", content: options.goal },
  ];

  let lastIssues: ValidationIssue[] = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { text } = await options.provider.complete({ messages });
    const parsed = parseModelText(text);
    if (parsed.ok) return parsed;

    lastIssues = parsed.issues;
    messages.push({ role: "assistant", content: text });
    messages.push({
      role: "user",
      content:
        "That was not a valid workflow. Fix it. Return JSON only.\n" +
        lastIssues
          .map((issue) =>
            issue.path
              ? `${issue.code} (${issue.path}): ${issue.message}`
              : `${issue.code}: ${issue.message}`,
          )
          .join("\n"),
    });
  }
  return { ok: false, issues: lastIssues };
}

function parseModelText(text: string): ParseWorkflowResult {
  try {
    return parseWorkflowDefinition(extractJson(text));
  } catch {
    return {
      ok: false,
      issues: [
        {
          code: "INVALID_SHAPE",
          message: "response was not valid JSON",
        },
      ],
    };
  }
}

/** Models often wrap JSON in markdown fences; the payload is still untrusted. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed);
  return JSON.parse(fenced?.[1] ?? trimmed) as unknown;
}

function systemPrompt(allowedTypes: readonly string[]): string {
  return [
    "You write a workflow plan as JSON. No markdown, no prose.",
    "Shape:",
    '{ "name": string, "nodes": [{ "id": slug, "type": string, "config": {} }], "edges": [{ "from": slug, "to": slug }] }',
    "id must be a lowercase slug (a-z, 0-9, '-', '_').",
    `type must be one of: ${allowedTypes.join(", ")}.`,
    "http-fetch config: { url, method?, headers? }",
    "http-post config: { url, body?, headers? }",
    "llm-call config: { prompt, model? }",
    "echo config: any JSON object.",
    "The graph must be a DAG. Parallel branches are fine.",
  ].join("\n");
}
