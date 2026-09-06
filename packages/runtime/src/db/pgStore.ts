import { and, eq, sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  parseWorkflowDefinition,
  type WorkflowDefinition,
} from "@workflow/graph";
import type { JsonObject, RunStatus } from "@workflow/shared";
import type { WorkerRegistry } from "@workflow/workers";
import { executeRun, type RunResult } from "../executeRun";
import {
  transitionNode,
  type NodeLifecycleState,
  type RetryPolicy,
} from "../nodeLifecycle";
import type { RunStore, TransitionRecord } from "../store";
import { nodeRuns, runEvents, runs, workflows } from "./schema";

export type Db = PostgresJsDatabase;

export function createDb(databaseUrl: string): { db: Db; close: () => Promise<void> } {
  const client = postgres(databaseUrl);
  return { db: drizzle(client), close: () => client.end() };
}

/**
 * Creating the schema is part of the library so tests and demos need no
 * separate migration toolchain. IF NOT EXISTS keeps it idempotent; a real
 * migration system replaces this when the schema starts evolving.
 */
export async function ensureSchema(db: Db): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS workflows (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      definition jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS runs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workflow_id uuid NOT NULL REFERENCES workflows(id),
      status text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS node_runs (
      run_id uuid NOT NULL REFERENCES runs(id),
      node_id text NOT NULL,
      status text NOT NULL,
      attempts integer NOT NULL DEFAULT 0,
      output jsonb,
      error text,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (run_id, node_id)
    );
    CREATE TABLE IF NOT EXISTS run_events (
      id bigserial PRIMARY KEY,
      run_id uuid NOT NULL REFERENCES runs(id),
      node_id text,
      event_type text NOT NULL,
      to_status text,
      detail jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

/** Persists the definition and a fresh run with every node pending. */
export async function createRun(
  db: Db,
  workflow: WorkflowDefinition,
): Promise<{ workflowId: string; runId: string }> {
  return db.transaction(async (tx) => {
    const [wf] = await tx
      .insert(workflows)
      .values({ name: workflow.name, definition: workflow })
      .returning({ id: workflows.id });
    if (wf === undefined) throw new Error("insert returned no workflow row");

    const [run] = await tx
      .insert(runs)
      .values({ workflowId: wf.id, status: "pending" })
      .returning({ id: runs.id });
    if (run === undefined) throw new Error("insert returned no run row");

    await tx.insert(nodeRuns).values(
      workflow.nodes.map((node) => ({
        runId: run.id,
        nodeId: node.id,
        status: "pending",
      })),
    );
    return { workflowId: wf.id, runId: run.id };
  });
}

export interface LoadedRun {
  workflow: WorkflowDefinition;
  states: Map<string, NodeLifecycleState>;
  outputs: Map<string, JsonObject>;
}

export async function loadRun(db: Db, runId: string): Promise<LoadedRun> {
  const [run] = await db.select().from(runs).where(eq(runs.id, runId));
  if (run === undefined) throw new Error(`run "${runId}" not found`);

  const [wf] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, run.workflowId));
  if (wf === undefined) throw new Error(`workflow for run "${runId}" not found`);

  // The definition was validated at submission, but it crossed a boundary
  // (Postgres) since: parse, don't trust.
  const parsed = parseWorkflowDefinition(wf.definition);
  if (!parsed.ok) {
    throw new Error(
      `stored definition for run "${runId}" is invalid: ${parsed.issues
        .map((issue) => issue.message)
        .join("; ")}`,
    );
  }

  const rows = await db.select().from(nodeRuns).where(eq(nodeRuns.runId, runId));
  const states = new Map<string, NodeLifecycleState>();
  const outputs = new Map<string, JsonObject>();
  for (const row of rows) {
    states.set(row.nodeId, {
      status: row.status as NodeLifecycleState["status"],
      attempts: row.attempts,
    });
    if (row.output !== null) outputs.set(row.nodeId, row.output as JsonObject);
  }
  return { workflow: parsed.workflow, states, outputs };
}

/** The engine's logbook, backed by node_runs (snapshot) + run_events (history). */
export class PgRunStore implements RunStore {
  constructor(
    private readonly db: Db,
    private readonly runId: string,
  ) {}

  async saveTransitions(records: TransitionRecord[]): Promise<void> {
    if (records.length === 0) return;
    await this.db.transaction(async (tx) => {
      for (const record of records) {
        await tx
          .update(nodeRuns)
          .set({
            status: record.state.status,
            attempts: record.state.attempts,
            ...(record.output !== undefined && { output: record.output }),
            ...(record.error !== undefined && { error: record.error }),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(nodeRuns.runId, this.runId),
              eq(nodeRuns.nodeId, record.nodeId),
            ),
          );
        await tx.insert(runEvents).values({
          runId: this.runId,
          nodeId: record.nodeId,
          eventType: record.event,
          toStatus: record.state.status,
          detail: record.error !== undefined ? { error: record.error } : null,
        });
      }
    });
  }

  async saveRunStatus(status: RunStatus): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(runs)
        .set({ status, updatedAt: new Date() })
        .where(eq(runs.id, this.runId));
      await tx.insert(runEvents).values({
        runId: this.runId,
        nodeId: null,
        eventType: "RUN_STATUS",
        toStatus: status,
      });
    });
  }
}

export interface RecoverRunOptions {
  workers: WorkerRegistry;
  retryPolicy?: RetryPolicy;
  onTransition?: (nodeId: string, state: NodeLifecycleState) => void;
}

/**
 * Resume a run after a crash. Nodes found `running` had an attempt with
 * unknown outcome (the crash gap): treat as a failed attempt — the reducer
 * requeues or permanently fails them by remaining budget (at-least-once;
 * the interrupted attempt already consumed budget when it was dispatched).
 * Everything else is the normal loop over reloaded state: the scheduler
 * cannot tell recovery from a slow Tuesday.
 */
export async function recoverRun(
  db: Db,
  runId: string,
  options: RecoverRunOptions,
): Promise<RunResult> {
  const policy = options.retryPolicy ?? { maxAttempts: 1 };
  const { workflow, states, outputs } = await loadRun(db, runId);
  const store = new PgRunStore(db, runId);

  const interrupted: TransitionRecord[] = [];
  for (const [nodeId, state] of states) {
    if (state.status !== "running") continue;
    const result = transitionNode(state, { type: "ATTEMPT_FAILED" }, policy);
    if (!result.ok) throw new Error(`recovery bug: ${result.reason}`);
    states.set(nodeId, result.state);
    interrupted.push({
      nodeId,
      event: "ATTEMPT_FAILED",
      state: result.state,
      error: "interrupted: runtime crashed during this attempt",
    });
  }
  if (interrupted.length > 0) {
    await store.saveTransitions(interrupted);
  }

  return executeRun({
    workflow,
    workers: options.workers,
    ...(options.retryPolicy !== undefined && { retryPolicy: options.retryPolicy }),
    ...(options.onTransition !== undefined && { onTransition: options.onTransition }),
    store,
    initialStates: states,
    initialOutputs: outputs,
  });
}
