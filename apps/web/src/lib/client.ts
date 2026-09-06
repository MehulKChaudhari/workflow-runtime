import type { RunSummary, RunView, ValidationIssue } from "./types";
import {
  INITIAL_RUNS,
  applyLiveDigestProgress,
  createRunFromWorkflow,
  delay,
  getStoredWorkflow,
  storeWorkflow,
  validateWorkflow,
} from "./mocks";

const runs = new Map<string, RunView>(
  INITIAL_RUNS.map((r) => [r.id, r]),
);

function toSummary(run: RunView): RunSummary {
  const live = applyLiveDigestProgress(run);
  const succeededNodes = live.nodes.filter((n) => n.status === "succeeded").length;
  return {
    id: live.id,
    workflowName: live.workflowName,
    status: live.status,
    startedAt: live.startedAt,
    totalNodes: live.nodes.length,
    succeededNodes,
  };
}

export async function listRuns(): Promise<RunSummary[]> {
  await delay();
  return [...runs.values()]
    .map((r) => toSummary(r))
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

export async function getRun(id: string): Promise<RunView> {
  await delay();
  const run = runs.get(id);
  if (!run) throw new Error(`run not found: ${id}`);
  const updated = applyLiveDigestProgress(run);
  runs.set(id, updated);
  return structuredClone(updated);
}

export async function submitWorkflow(
  def: unknown,
): Promise<
  { ok: true; workflowId: string } | { ok: false; issues: ValidationIssue[] }
> {
  await delay();
  const result = validateWorkflow(def);
  if (!result.ok) return result;
  const workflowId = storeWorkflow(result.workflow);
  return { ok: true, workflowId };
}

export async function startRun(workflowId: string): Promise<{ runId: string }> {
  await delay();
  const def = getStoredWorkflow(workflowId);
  if (!def) throw new Error(`workflow not found: ${workflowId}`);
  const run = createRunFromWorkflow(workflowId, def);
  runs.set(run.id, run);
  return { runId: run.id };
}
