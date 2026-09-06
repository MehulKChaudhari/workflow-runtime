import { describe, expect, it } from "vitest";
import type { CompleteRequest } from "@workflow/provider";
import { createFakeProvider } from "@workflow/provider";
import { extractJson, planWorkflow } from "./plan";

const validCake = {
  name: "cake",
  nodes: [
    { id: "buy", type: "echo", config: {} },
    { id: "bake", type: "echo", config: {} },
  ],
  edges: [{ from: "buy", to: "bake" }],
};

describe("extractJson", () => {
  it("parses fenced JSON", () => {
    expect(extractJson("```json\n{\"name\":\"x\"}\n```")).toEqual({ name: "x" });
  });
});

describe("planWorkflow", () => {
  it("returns a validated workflow from a good first reply", async () => {
    const result = await planWorkflow({
      goal: "bake a cake",
      provider: createFakeProvider({ text: JSON.stringify(validCake) }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.workflow.name).toBe("cake");
    expect(result.workflow.nodes.map((n) => n.id)).toEqual(["buy", "bake"]);
  });

  it("repairs after a cycle using the validation error", async () => {
    let calls = 0;
    const provider = createFakeProvider({
      text: (request: CompleteRequest) => {
        calls += 1;
        if (calls === 1) {
          return JSON.stringify({
            name: "loop",
            nodes: [
              { id: "a", type: "echo", config: {} },
              { id: "b", type: "echo", config: {} },
            ],
            edges: [
              { from: "a", to: "b" },
              { from: "b", to: "a" },
            ],
          });
        }
        const last = request.messages.at(-1)?.content ?? "";
        expect(last).toContain("CYCLE_DETECTED");
        return JSON.stringify(validCake);
      },
    });

    const result = await planWorkflow({ goal: "do stuff", provider });
    expect(result.ok).toBe(true);
    expect(calls).toBe(2);
  });

  it("gives up after the retry budget with the last issues", async () => {
    const result = await planWorkflow({
      goal: "whatever",
      provider: createFakeProvider({ text: "not json at all" }),
      maxAttempts: 2,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.message).toContain("not valid JSON");
  });
});
