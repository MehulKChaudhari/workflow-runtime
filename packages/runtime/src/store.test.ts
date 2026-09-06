import { describe, expect, it } from "vitest";
import type { Worker } from "@workflow/workers";
import { executeRun } from "./executeRun";
import { InMemoryRunStore, type RunStore, type TransitionRecord } from "./store";

describe("engine + store ordering", () => {
  it("persists DISPATCHED before the worker runs (persist-before-act)", async () => {
    const timeline: string[] = [];

    const spyStore: RunStore = {
      async saveTransitions(records: TransitionRecord[]) {
        for (const r of records) timeline.push(`saved:${r.nodeId}:${r.event}`);
      },
      async saveRunStatus() {},
    };

    const worker: Worker = async () => {
      timeline.push("worker:started");
      return {};
    };

    await executeRun({
      workflow: {
        name: "ordering",
        nodes: [{ id: "one", type: "w", config: {} }],
        edges: [],
      },
      workers: new Map([["w", worker]]),
      store: spyStore,
    });

    const dispatched = timeline.indexOf("saved:one:DISPATCHED");
    const started = timeline.indexOf("worker:started");
    const succeeded = timeline.indexOf("saved:one:ATTEMPT_SUCCEEDED");
    expect(dispatched).toBeGreaterThanOrEqual(0);
    expect(dispatched).toBeLessThan(started);
    expect(started).toBeLessThan(succeeded);
  });

  it("records a full, replayable transition history", async () => {
    const store = new InMemoryRunStore();
    let calls = 0;
    const flaky: Worker = async () => {
      calls += 1;
      if (calls === 1) throw new Error("first try fails");
      return {};
    };

    await executeRun({
      workflow: {
        name: "history",
        nodes: [{ id: "one", type: "flaky", config: {} }],
        edges: [],
      },
      workers: new Map([["flaky", flaky]]),
      retryPolicy: { maxAttempts: 2 },
      store,
    });

    expect(store.transitions.map((t) => `${t.event}:${t.state.status}`)).toEqual([
      "DEPENDENCIES_MET:ready",
      "DISPATCHED:running",
      "ATTEMPT_FAILED:ready",
      "DISPATCHED:running",
      "ATTEMPT_SUCCEEDED:succeeded",
    ]);
    // the failed attempt kept its error in the record
    expect(store.transitions[2]?.error).toBe("first try fails");
    expect(store.runStatuses.at(-1)).toBe("succeeded");
  });
});
