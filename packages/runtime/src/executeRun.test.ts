import { describe, expect, it } from "vitest";
import type { WorkflowDefinition } from "@workflow/graph";
import type { JsonObject } from "@workflow/shared";
import { echoWorker, type Worker } from "@workflow/workers";
import { executeRun } from "./executeRun";
import type { NodeLifecycleState } from "./nodeLifecycle";

function cake(types?: Partial<Record<string, string>>): WorkflowDefinition {
  const t = (id: string, fallback: string) => types?.[id] ?? fallback;
  return {
    name: "birthday cake",
    nodes: [
      { id: "buy", type: t("buy", "echo"), config: { list: ["flour"] } },
      { id: "bake", type: t("bake", "echo"), config: { minutes: 40 } },
      { id: "make-frosting", type: t("make-frosting", "echo"), config: {} },
      { id: "frost", type: t("frost", "echo"), config: {} },
    ],
    edges: [
      { from: "buy", to: "bake" },
      { from: "buy", to: "make-frosting" },
      { from: "bake", to: "frost" },
      { from: "make-frosting", to: "frost" },
    ],
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("executeRun", () => {
  it("runs the cake to success and flows outputs along edges", async () => {
    const transitions: Array<[string, string]> = [];
    const result = await executeRun({
      workflow: cake(),
      workers: new Map([["echo", echoWorker]]),
      onTransition: (id, state) => transitions.push([id, state.status]),
    });

    expect(result.status).toBe("succeeded");
    for (const node of ["buy", "bake", "make-frosting", "frost"]) {
      expect(result.nodes.get(node)?.status).toBe("succeeded");
      expect(result.nodes.get(node)?.attempts).toBe(1);
    }

    // frost's inputs are exactly its parents' outputs
    const frostOutput = result.outputs.get("frost");
    expect(Object.keys((frostOutput as any).inputs).sort()).toEqual([
      "bake",
      "make-frosting",
    ]);

    // dependency order is respected: buy succeeded before bake ran
    const at = (id: string, status: string) =>
      transitions.findIndex(([n, s]) => n === id && s === status);
    expect(at("buy", "succeeded")).toBeLessThan(at("bake", "running"));
    expect(at("bake", "succeeded")).toBeLessThan(at("frost", "running"));
  });

  it("actually runs independent branches concurrently", async () => {
    let active = 0;
    let maxActive = 0;
    const slow: Worker = async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await sleep(30);
      active -= 1;
      return {};
    };

    const result = await executeRun({
      workflow: cake({ bake: "slow", "make-frosting": "slow" }),
      workers: new Map<string, Worker>([
        ["echo", echoWorker],
        ["slow", slow],
      ]),
    });

    expect(result.status).toBe("succeeded");
    expect(maxActive).toBe(2); // bake and make-frosting overlapped
  });

  it("retries a flaky worker until it succeeds, counting attempts", async () => {
    let calls = 0;
    const flaky: Worker = async () => {
      calls += 1;
      if (calls < 3) throw new Error(`flake #${calls}`);
      return { calls };
    };

    const result = await executeRun({
      workflow: {
        name: "flaky",
        nodes: [{ id: "one", type: "flaky", config: {} }],
        edges: [],
      },
      workers: new Map([["flaky", flaky]]),
      retryPolicy: { maxAttempts: 3 },
    });

    expect(result.status).toBe("succeeded");
    expect(result.nodes.get("one")).toEqual({
      status: "succeeded",
      attempts: 3,
    });
    // the failed attempts left a trace even though the node recovered
    expect(result.errors.get("one")).toBe("flake #2");
  });

  it("fails the run, skips descendants, lets independent branches finish", async () => {
    const boom: Worker = async () => {
      throw new Error("oven caught fire");
    };

    const result = await executeRun({
      workflow: cake({ bake: "boom" }),
      workers: new Map<string, Worker>([
        ["echo", echoWorker],
        ["boom", boom],
      ]),
      retryPolicy: { maxAttempts: 2 },
    });

    expect(result.status).toBe("failed");
    expect(result.nodes.get("bake")).toEqual({ status: "failed", attempts: 2 });
    expect(result.errors.get("bake")).toBe("oven caught fire");
    expect(result.nodes.get("frost")?.status).toBe("skipped");
    // the independent branch was not interrupted
    expect(result.nodes.get("make-frosting")?.status).toBe("succeeded");
  });

  it("normalizes non-Error throws into readable messages", async () => {
    const rude: Worker = async () => {
      throw "just a string";
    };
    const result = await executeRun({
      workflow: {
        name: "rude",
        nodes: [{ id: "one", type: "rude", config: {} }],
        edges: [],
      },
      workers: new Map([["rude", rude]]),
    });
    expect(result.status).toBe("failed");
    expect(result.errors.get("one")).toBe("just a string");
  });

  it("refuses to start when a node type has no worker", async () => {
    await expect(
      executeRun({
        workflow: cake({ bake: "htp-fetch" }),
        workers: new Map([["echo", echoWorker]]),
      }),
    ).rejects.toThrow('no worker registered for node type(s): htp-fetch');
  });

  it("runs a disconnected node immediately alongside entry nodes", async () => {
    const wf: WorkflowDefinition = {
      name: "with loner",
      nodes: [
        { id: "a", type: "echo", config: {} },
        { id: "b", type: "echo", config: {} },
        { id: "loner", type: "echo", config: { alone: true } },
      ],
      edges: [{ from: "a", to: "b" }],
    };
    const result = await executeRun({
      workflow: wf,
      workers: new Map([["echo", echoWorker]]),
    });
    expect(result.status).toBe("succeeded");
    expect(
      (result.outputs.get("loner") as { config: JsonObject }).config,
    ).toEqual({ alone: true });
  });

  it("a node with mixed terminal parents (succeeded + failed) is skipped", async () => {
    const boom: Worker = async () => {
      throw new Error("no");
    };
    const wf: WorkflowDefinition = {
      name: "mixed parents",
      nodes: [
        { id: "good", type: "echo", config: {} },
        { id: "bad", type: "boom", config: {} },
        { id: "child", type: "echo", config: {} },
      ],
      edges: [
        { from: "good", to: "child" },
        { from: "bad", to: "child" },
      ],
    };
    const result = await executeRun({
      workflow: wf,
      workers: new Map<string, Worker>([
        ["echo", echoWorker],
        ["boom", boom],
      ]),
    });
    expect(result.status).toBe("failed");
    expect(result.nodes.get("child")?.status).toBe("skipped");
  });
});

// Type-level check that onTransition receives full lifecycle state.
const _stateCheck = (s: NodeLifecycleState): number => s.attempts;
void _stateCheck;
