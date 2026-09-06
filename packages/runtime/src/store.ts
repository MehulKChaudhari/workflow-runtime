import type { JsonObject, RunStatus } from "@workflow/shared";
import type { NodeEvent, NodeLifecycleState } from "./nodeLifecycle";

/** One applied transition, as it should be remembered. */
export interface TransitionRecord {
  nodeId: string;
  event: ["type"];
  /** State after the transition. */
  state: NodeLifecycleState;
  output?: JsonObject;
  error?: string;
}

/**
 * The engine's logbook. The engine writes through this before acting;
 * memory is just its working copy. Swapping the implementation is how the
 * same loop runs in tests (in-memory) and production (Postgres).
 */
export interface RunStore {
  /**
   * Persist a batch atomically. The engine sends one batch per scheduler
   * tick (a tick's decisions are one logical fact) and single-record
   * batches for dispatches and outcomes (persist-before-act needs the
   * record on disk immediately before the side effect).
   */
  saveTransitions(records: TransitionRecord[]): Promise<void>;
  saveRunStatus(status: RunStatus): Promise<void>;
}

/** Keeps the engine honest in tests without a database. */
export class InMemoryRunStore implements RunStore {
  readonly transitions: TransitionRecord[] = [];
  readonly runStatuses: RunStatus[] = [];

  async saveTransitions(records: TransitionRecord[]): Promise<void> {
    this.transitions.push(...records);
  }

  async saveRunStatus(status: RunStatus): Promise<void> {
    this.runStatuses.push(status);
  }
}
