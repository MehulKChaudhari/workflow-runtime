import type { WorkflowDefinition } from "@workflow/graph";
import { schedule } from "@workflow/scheduler";
import type { JsonObject, NodeStatus, RunStatus } from "@workflow/shared";
import type { WorkerRegistry } from "@workflow/workers";
import {
  initialNodeState,
  transitionNode,
  type NodeEvent,
  type NodeLifecycleState,
  type RetryPolicy,
} from "./nodeLifecycle";
import { computeRunStatus } from "./runStatus";
import { InMemoryRunStore, type RunStore, type TransitionRecord } from "./store";

export interface ExecuteRunOptions {
  workflow: WorkflowDefinition;
  workers: WorkerRegistry;
  retryPolicy?: RetryPolicy;
  /** The logbook. Defaults to in-memory (no durability). */
  store?: RunStore;
  /** Observability hook: fired after every applied transition. */
  onTransition?: (nodeId: string, state: NodeLifecycleState) => void;
  /** Resume support: start from previously persisted state instead of fresh. */
  initialStates?: Map<string, NodeLifecycleState>;
  initialOutputs?: Map<string, JsonObject>;
}

export interface RunResult {
  status: RunStatus;
  nodes: ReadonlyMap<string, NodeLifecycleState>;
  outputs: ReadonlyMap<string, JsonObject>;
  /** Last attempt error per node that ever failed an attempt. */
  errors: ReadonlyMap<string, string>;
}

interface WorkerOutcome {
  nodeId: string;
  ok: boolean;
  output?: JsonObject;
  error?: string;
}

/**
 * Runs one workflow to completion. The loop only wires decisions to
 * effects: the scheduler says who advances, transitionNode is the sole
 * doorway for status changes, workers perform the effects, and every
 * change is written to the store before the effect it authorizes.
 */
export async function executeRun(
  options: ExecuteRunOptions,
): Promise<RunResult> {
  const { workflow, workers, onTransition } = options;
  const policy = options.retryPolicy ?? { maxAttempts: 1 };
  const store = options.store ?? new InMemoryRunStore();

  // A node type without a worker is a plan defect, not a runtime event:
  // retrying would never make the worker exist, so refuse to start.
  const unknownTypes = [
    ...new Set(
      workflow.nodes
        .filter((node) => !workers.has(node.type))
        .map((node) => node.type),
    ),
  ];
  if (unknownTypes.length > 0) {
    throw new Error(
      `no worker registered for node type(s): ${unknownTypes.join(", ")}`,
    );
  }

  const states =
    options.initialStates ??
    new Map<string, NodeLifecycleState>(
      workflow.nodes.map((node) => [node.id, initialNodeState()]),
    );
  const outputs = options.initialOutputs ?? new Map<string, JsonObject>();
  const errors = new Map<string, string>();
  const parents = parentsByNode(workflow);
  const inFlight = new Map<string, Promise<WorkerOutcome>>();

  // Applies in memory only; persistence is the caller's next line. Split
  // so a tick can batch many transitions into one atomic save.
  const apply = (
    nodeId: string,
    event: NodeEvent,
    extra?: { output?: JsonObject; error?: string },
  ): TransitionRecord => {
    const current = states.get(nodeId);
    if (current === undefined) {
      throw new Error(`unknown node "${nodeId}"`);
    }
    const result = transitionNode(current, event, policy);
    // An illegal transition here is an engine bug; corrupting state
    // silently would be worse than crashing the run.
    if (!result.ok) {
      throw new Error(`engine bug: ${result.reason} (node "${nodeId}")`);
    }
    states.set(nodeId, result.state);
    onTransition?.(nodeId, result.state);
    return {
      nodeId,
      event: event.type,
      state: result.state,
      ...(extra?.output !== undefined && { output: extra.output }),
      ...(extra?.error !== undefined && { error: extra.error }),
    };
  };

  const statuses = (): Map<string, NodeStatus> =>
    new Map([...states].map(([id, state]) => [id, state.status]));

  let lastSavedRunStatus: RunStatus | undefined;
  const syncRunStatus = async (): Promise<RunStatus> => {
    const runStatus = computeRunStatus(
      [...states.values()].map((state) => state.status),
    );
    if (runStatus !== lastSavedRunStatus) {
      await store.saveRunStatus(runStatus);
      lastSavedRunStatus = runStatus;
    }
    return runStatus;
  };

  while (true) {
    // Let scheduling reach a fixpoint: a skip can unlock further skips
    // (the ripple travels one hop per look). One tick = one atomic save.
    const tickRecords: TransitionRecord[] = [];
    while (true) {
      const decision = schedule(workflow, statuses());
      if (
        decision.becomeReady.length === 0 &&
        decision.becomeSkipped.length === 0
      ) {
        break;
      }
      for (const id of decision.becomeReady) {
        tickRecords.push(apply(id, { type: "DEPENDENCIES_MET" }));
      }
      for (const id of decision.becomeSkipped) {
        tickRecords.push(apply(id, { type: "UPSTREAM_FAILED" }));
      }
    }
    if (tickRecords.length > 0) {
      await store.saveTransitions(tickRecords);
    }

    for (const node of workflow.nodes) {
      if (states.get(node.id)?.status !== "ready") continue;

      // Persist the dispatch before invoking the worker: after a crash the
      // record must say "an attempt started with unknown outcome".
      const record = apply(node.id, { type: "DISPATCHED" });
      await store.saveTransitions([record]);

      const inputs: Record<string, JsonObject> = {};
      for (const parentId of parents.get(node.id) ?? []) {
        const parentOutput = outputs.get(parentId);
        if (parentOutput !== undefined) inputs[parentId] = parentOutput;
      }

      const worker = workers.get(node.type);
      if (worker === undefined) {
        throw new Error(`engine bug: worker "${node.type}" vanished`);
      }
      inFlight.set(
        node.id,
        worker({ config: node.config, inputs }).then(
          (output): WorkerOutcome => ({ nodeId: node.id, ok: true, output }),
          (cause): WorkerOutcome => ({
            nodeId: node.id,
            ok: false,
            error: cause instanceof Error ? cause.message : String(cause),
          }),
        ),
      );
    }

    const runStatus = await syncRunStatus();
    if (runStatus === "succeeded" || runStatus === "failed") {
      return { status: runStatus, nodes: states, outputs, errors };
    }

    if (inFlight.size === 0) {
      // A valid DAG always has runnable work until terminal; reaching
      // here means scheduling and lifecycle disagree.
      throw new Error("engine bug: run not terminal but nothing is running");
    }

    const done = await Promise.race(inFlight.values());
    inFlight.delete(done.nodeId);
    if (done.ok) {
      const output = done.output ?? {};
      outputs.set(done.nodeId, output);
      const record = apply(done.nodeId, { type: "ATTEMPT_SUCCEEDED" }, { output });
      await store.saveTransitions([record]);
    } else {
      const error = done.error ?? "unknown error";
      errors.set(done.nodeId, error);
      const record = apply(done.nodeId, { type: "ATTEMPT_FAILED" }, { error });
      await store.saveTransitions([record]);
    }
  }
}

function parentsByNode(workflow: WorkflowDefinition): Map<string, string[]> {
  const parents = new Map<string, string[]>();
  for (const node of workflow.nodes) parents.set(node.id, []);
  for (const edge of workflow.edges) parents.get(edge.to)?.push(edge.from);
  return parents;
}
