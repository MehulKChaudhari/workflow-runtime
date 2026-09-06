import type { JsonObject } from "@workflow/shared";

/** Everything a worker gets. It never sees the graph, other nodes, or statuses. */
export interface WorkerInput {
  /** The node's own config from the workflow definition. */
  config: JsonObject;
  /**
   * Outputs of the node's parents, keyed by parent node id. This is how
   * data flows along edges: a parent's output is its children's input.
   */
  inputs: Record<string, JsonObject>;
}

/**
 * One unit of work. Returns the node's output (someone else's input later);
 * throws to fail the attempt — the runtime catches, records the message and
 * decides retry vs permanent failure. Workers may be invoked more than once
 * per node (at-least-once semantics), so side effects should be idempotent.
 */
export type Worker = (input: WorkerInput) => Promise<JsonObject>;

/** Which worker runs a node is decided by `NodeDefinition.type`. */
export type WorkerRegistry = ReadonlyMap<string, Worker>;
