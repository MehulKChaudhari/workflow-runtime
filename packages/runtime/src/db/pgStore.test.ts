import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { WorkflowDefinition } from "@workflow/graph";
import { echoWorker, type Worker } from "@workflow/workers";
import { executeRun } from "../executeRun";
import {
  PgRunStore,
  createDb,
  createRun,
  ensureSchema,
  loadRun,
  recoverRun,
  type Db,
} from "./pgStore";
import { nodeRuns, runEvents, runs } from "./schema";

const DATABASE_URL = process.env["DATABASE_URL"];

const cake: WorkflowDefinition = {
  name: "birthday cake",
  nodes: [
    { id: "buy", type: "echo", config: { list: ["flour"] } },
    { id: "bake", type: "echo", config: { minutes: 40 } },
    { id: "make-frosting", type: "echo", config: {} },
    { id: "frost", type: "echo", config: {} },
  ],
  edges: [
    { from: "buy", to: "bake" },
    { from: "buy", to: "make-frosting" },
    { from: "bake", to: "frost" },
    { from: "make-frosting", to: "frost" },
  ],
};

describe.skipIf(!DATABASE_URL)("PgRunStore (needs DATABASE_URL)", () => {
  let db: Db;
  let close: () => Promise<void>;

  beforeAll(async () => {
    ({ db, close } = createDb(DATABASE_URL as string));
    await ensureSchema(db);
  });

  afterAll(async () => {
    await close?.();
  });

  it("persists a full run: statuses, outputs, and an event history", async () => {
    const { runId } = await createRun(db, cake);

    const result = await executeRun({
      workflow: cake,
      workers: new Map([["echo", echoWorker]]),
      store: new PgRunStore(db, runId),
    });
    expect(result.status).toBe("succeeded");

    const [run] = await db.select().from(runs).where(eq(runs.id, runId));
    expect(run?.status).toBe("succeeded");

    const rows = await db
      .select()
      .from(nodeRuns)
      .where(eq(nodeRuns.runId, runId));
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.status === "succeeded")).toBe(true);
    const frost = rows.find((r) => r.nodeId === "frost");
    expect(Object.keys((frost?.output as any).inputs).sort()).toEqual([
      "bake",
      "make-frosting",
    ]);

    const events = await db
      .select()
      .from(runEvents)
      .where(eq(runEvents.runId, runId));
    // 4 ready + 4 dispatched + 4 succeeded + run status changes
    expect(events.filter((e) => e.eventType === "DISPATCHED")).toHaveLength(4);
    expect(
      events.filter((e) => e.eventType === "ATTEMPT_SUCCEEDED"),
    ).toHaveLength(4);
  });

  it("recovers a run whose process died mid-flight", async () => {
    const { runId } = await createRun(db, cake);
    const store = new PgRunStore(db, runId);
    const workers = new Map<string, Worker>([["echo", echoWorker]]);
    const policy = { maxAttempts: 2 };

    // Simulate the crash moment by persisting a legal prefix of a run:
    // buy succeeded (output saved), bake dispatched and never heard from.
    await store.saveTransitions([
      {
        nodeId: "buy",
        event: "DEPENDENCIES_MET",
        state: { status: "ready", attempts: 0 },
      },
      {
        nodeId: "buy",
        event: "DISPATCHED",
        state: { status: "running", attempts: 1 },
      },
      {
        nodeId: "buy",
        event: "ATTEMPT_SUCCEEDED",
        state: { status: "succeeded", attempts: 1 },
        output: { bought: true },
      },
      {
        nodeId: "bake",
        event: "DEPENDENCIES_MET",
        state: { status: "ready", attempts: 0 },
      },
      {
        nodeId: "bake",
        event: "DISPATCHED",
        state: { status: "running", attempts: 1 },
      },
    ]);

    // New process: reload the logbook and continue.
    const result = await recoverRun(db, runId, { workers, retryPolicy: policy });

    expect(result.status).toBe("succeeded");
    // buy was NOT re-run: attempts stayed 1, output preserved from before the crash
    expect(result.nodes.get("buy")).toEqual({ status: "succeeded", attempts: 1 });
    // bake's interrupted attempt burned budget; the retry succeeded
    expect(result.nodes.get("bake")).toEqual({ status: "succeeded", attempts: 2 });
    // frost received buy's pre-crash output through bake's inputs chain
    const { states } = await loadRun(db, runId);
    expect(states.get("frost")?.status).toBe("succeeded");

    const events = await db
      .select()
      .from(runEvents)
      .where(eq(runEvents.runId, runId));
    const interrupted = events.find(
      (e) =>
        e.nodeId === "bake" &&
        e.eventType === "ATTEMPT_FAILED" &&
        (e.detail as any)?.error?.includes("interrupted"),
    );
    expect(interrupted).toBeDefined();
  });

  it("recovery fails a run when the interrupted node has no budget left", async () => {
    const { runId } = await createRun(db, cake);
    const store = new PgRunStore(db, runId);

    await store.saveTransitions([
      {
        nodeId: "buy",
        event: "DEPENDENCIES_MET",
        state: { status: "ready", attempts: 0 },
      },
      {
        nodeId: "buy",
        event: "DISPATCHED",
        state: { status: "running", attempts: 1 },
      },
    ]);

    const result = await recoverRun(db, runId, {
      workers: new Map([["echo", echoWorker]]),
      retryPolicy: { maxAttempts: 1 },
    });

    expect(result.status).toBe("failed");
    expect(result.nodes.get("buy")?.status).toBe("failed");
    // everything downstream of buy was skipped, nothing ran
    expect(result.nodes.get("frost")?.status).toBe("skipped");
  });
});
