/**
 * @workflow/runtime — the execution engine. Owns execution semantics:
 * which lifecycle transitions are legal and how failure is handled.
 */
export {
  initialNodeState,
  transitionNode,
  type NodeLifecycleState,
  type NodeEvent,
  type NodeTransitionResult,
  type RetryPolicy,
} from "./nodeLifecycle";
export { computeRunStatus } from "./runStatus";
export {
  executeRun,
  type ExecuteRunOptions,
  type RunResult,
} from "./executeRun";
export {
  InMemoryRunStore,
  type RunStore,
  type TransitionRecord,
} from "./store";
export {
  createDb,
  ensureSchema,
  createRun,
  loadRun,
  recoverRun,
  PgRunStore,
  type Db,
  type RecoverRunOptions,
} from "./db/pgStore";
