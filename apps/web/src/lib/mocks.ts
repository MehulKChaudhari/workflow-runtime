import birthdayCake from "@examples/birthday-cake.json";
import ycDigest from "@examples/yc-digest.json";
import type {
  NodeRunView,
  NodeStatus,
  RunStatus,
  RunView,
  ValidationIssue,
  WorkflowDefinition,
} from "./types";

export const EXAMPLE_WORKFLOWS = {
  "birthday-cake": birthdayCake as WorkflowDefinition,
  "yc-digest": ycDigest as WorkflowDefinition,
} as const;

const latency = () => 100 + Math.floor(Math.random() * 200);
export const delay = (ms = latency()) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function allPending(def: WorkflowDefinition): NodeRunView[] {
  return def.nodes.map((n) => ({
    nodeId: n.id,
    status: "pending" as const,
    attempts: 0,
  }));
}

function nodeViews(
  def: WorkflowDefinition,
  statuses: Record<string, Partial<NodeRunView>>,
): NodeRunView[] {
  return def.nodes.map((n) => ({
    nodeId: n.id,
    status: "pending",
    attempts: 0,
    ...statuses[n.id],
  }));
}

const cakeDone = EXAMPLE_WORKFLOWS["birthday-cake"];
const cakeFailed = EXAMPLE_WORKFLOWS["birthday-cake"];
const digestDef = EXAMPLE_WORKFLOWS["yc-digest"];

export const INITIAL_RUNS: RunView[] = [
  {
    id: "run-live-digest",
    workflowName: digestDef.name,
    status: "running",
    startedAt: new Date(Date.now() - 8_000).toISOString(),
    definition: digestDef,
    nodes: allPending(digestDef),
  },
  {
    id: "run-cake-done",
    workflowName: cakeDone.name,
    status: "succeeded",
    startedAt: new Date(Date.now() - 3600_000).toISOString(),
    definition: cakeDone,
    nodes: nodeViews(cakeDone, {
      buy: {
        status: "succeeded",
        attempts: 1,
        output: { receipt: "corner market #4421", cost: 18.4 },
      },
      bake: {
        status: "succeeded",
        attempts: 1,
        output: { layers: 2, rise: "even" },
      },
      "make-frosting": {
        status: "succeeded",
        attempts: 1,
        output: { volumeCups: 3 },
      },
      frost: {
        status: "succeeded",
        attempts: 1,
        output: { candles: 6 },
      },
    }),
  },
  {
    id: "run-cake-failed",
    workflowName: cakeFailed.name,
    status: "failed",
    startedAt: new Date(Date.now() - 7200_000).toISOString(),
    definition: cakeFailed,
    nodes: nodeViews(cakeFailed, {
      buy: {
        status: "succeeded",
        attempts: 1,
        output: { receipt: "corner market #4398" },
      },
      bake: {
        status: "failed",
        attempts: 3,
        error: "oven temperature dropped below 300F after 12 minutes",
      },
      "make-frosting": {
        status: "succeeded",
        attempts: 1,
        output: { volumeCups: 3 },
      },
      frost: { status: "skipped", attempts: 0 },
    }),
  },
];

/** Ordered snapshots for the live digest run; index advances every ~1.5s. */
const DIGEST_TICKS: Array<Record<string, NodeStatus>> = [
  {},
  { "fetch-yc-news": "running" },
  { "fetch-yc-news": "succeeded", "summarize-story-1": "ready", "summarize-story-2": "ready", "summarize-story-3": "ready" },
  { "fetch-yc-news": "succeeded", "summarize-story-1": "running", "summarize-story-2": "running", "summarize-story-3": "ready" },
  {
    "fetch-yc-news": "succeeded",
    "summarize-story-1": "running",
    "summarize-story-2": "succeeded",
    "summarize-story-3": "running",
  },
  {
    "fetch-yc-news": "succeeded",
    "summarize-story-1": "succeeded",
    "summarize-story-2": "succeeded",
    "summarize-story-3": "succeeded",
    "merge-digest": "ready",
  },
  {
    "fetch-yc-news": "succeeded",
    "summarize-story-1": "succeeded",
    "summarize-story-2": "succeeded",
    "summarize-story-3": "succeeded",
    "merge-digest": "running",
  },
  {
    "fetch-yc-news": "succeeded",
    "summarize-story-1": "succeeded",
    "summarize-story-2": "succeeded",
    "summarize-story-3": "succeeded",
    "merge-digest": "succeeded",
    "save-digest": "ready",
  },
  {
    "fetch-yc-news": "succeeded",
    "summarize-story-1": "succeeded",
    "summarize-story-2": "succeeded",
    "summarize-story-3": "succeeded",
    "merge-digest": "succeeded",
    "save-digest": "running",
  },
  {
    "fetch-yc-news": "succeeded",
    "summarize-story-1": "succeeded",
    "summarize-story-2": "succeeded",
    "summarize-story-3": "succeeded",
    "merge-digest": "succeeded",
    "save-digest": "succeeded",
  },
];

const TICK_MS = 1500;
const liveRunStartedAt = Date.parse(INITIAL_RUNS[0]!.startedAt);

export function applyLiveDigestProgress(run: RunView, now = Date.now()): RunView {
  if (run.id !== "run-live-digest") return run;

  const elapsed = now - liveRunStartedAt;
  const tick = Math.min(
    DIGEST_TICKS.length - 1,
    Math.floor(elapsed / TICK_MS),
  );
  const snapshot = DIGEST_TICKS[tick] ?? {};

  const nodes = run.definition.nodes.map((n) => {
    const status = snapshot[n.id] ?? "pending";
    const attempts =
      status === "pending" || status === "skipped"
        ? 0
        : status === "ready"
          ? 0
          : 1;
    const base: NodeRunView = { nodeId: n.id, status, attempts };
    if (status === "succeeded") {
      base.output = { mock: true, node: n.id };
    }
    return base;
  });

  const allDone = nodes.every((n) => n.status === "succeeded");
  const status: RunStatus = allDone ? "succeeded" : "running";

  return { ...run, nodes, status };
}

const workflows = new Map<string, WorkflowDefinition>();
let workflowSeq = 1;
let runSeq = 100;

export function nextWorkflowId(): string {
  return `wf-${workflowSeq++}`;
}

export function nextRunId(): string {
  return `run-${runSeq++}`;
}

export function storeWorkflow(def: WorkflowDefinition): string {
  const id = nextWorkflowId();
  workflows.set(id, def);
  return id;
}

export function getStoredWorkflow(id: string): WorkflowDefinition | undefined {
  return workflows.get(id);
}

export function validateWorkflow(input: unknown):
  | { ok: true; workflow: WorkflowDefinition }
  | { ok: false; issues: ValidationIssue[] } {
  if (!input || typeof input !== "object") {
    return {
      ok: false,
      issues: [{ code: "INVALID_SHAPE", message: "workflow must be a JSON object" }],
    };
  }

  const raw = input as Record<string, unknown>;
  const issues: ValidationIssue[] = [];

  if (typeof raw.name !== "string" || raw.name.length === 0) {
    issues.push({ code: "INVALID_SHAPE", message: "name is required", path: "name" });
  }
  if (!Array.isArray(raw.nodes) || raw.nodes.length === 0) {
    issues.push({
      code: "INVALID_SHAPE",
      message: "nodes must be a non-empty array",
      path: "nodes",
    });
  }
  if (!Array.isArray(raw.edges)) {
    issues.push({
      code: "INVALID_SHAPE",
      message: "edges must be an array",
      path: "edges",
    });
  }
  if (issues.length > 0) return { ok: false, issues };

  const nodes = raw.nodes as Array<Record<string, unknown>>;
  const edges = raw.edges as Array<Record<string, unknown>>;
  const nodeIds = new Set<string>();

  for (const [i, node] of nodes.entries()) {
    if (typeof node.id !== "string") {
      issues.push({
        code: "INVALID_SHAPE",
        message: "node id must be a string",
        path: `nodes.${i}.id`,
      });
      continue;
    }
    if (nodeIds.has(node.id)) {
      issues.push({
        code: "DUPLICATE_NODE_ID",
        message: `node id "${node.id}" is used more than once`,
        path: `nodes.${i}.id`,
      });
    }
    nodeIds.add(node.id);
    if (typeof node.type !== "string" || node.type.length === 0) {
      issues.push({
        code: "INVALID_SHAPE",
        message: "node type is required",
        path: `nodes.${i}.type`,
      });
    }
  }

  const seenEdges = new Set<string>();
  for (const [i, edge] of edges.entries()) {
    const from = edge.from;
    const to = edge.to;
    if (typeof from !== "string" || typeof to !== "string") {
      issues.push({
        code: "INVALID_SHAPE",
        message: "edge from/to must be strings",
        path: `edges.${i}`,
      });
      continue;
    }
    if (!nodeIds.has(from) || !nodeIds.has(to)) {
      issues.push({
        code: "UNKNOWN_NODE_REFERENCE",
        message: `edge ${from} -> ${to} references unknown node`,
        path: `edges.${i}`,
      });
    }
    if (from === to) {
      issues.push({
        code: "SELF_DEPENDENCY",
        message: `node "${from}" depends on itself`,
        path: `edges.${i}`,
      });
    }
    const key = `${from}->${to}`;
    if (seenEdges.has(key)) {
      issues.push({
        code: "DUPLICATE_EDGE",
        message: `edge ${key} is declared more than once`,
        path: `edges.${i}`,
      });
    }
    seenEdges.add(key);
  }

  if (issues.length > 0) return { ok: false, issues };

  // Kahn's algorithm for cycle detection
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  for (const id of nodeIds) {
    incoming.set(id, 0);
    outgoing.set(id, []);
  }
  for (const edge of edges) {
    const from = edge.from as string;
    const to = edge.to as string;
    incoming.set(to, (incoming.get(to) ?? 0) + 1);
    outgoing.get(from)?.push(to);
  }
  const queue = [...nodeIds].filter((id) => (incoming.get(id) ?? 0) === 0);
  let visited = 0;
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) break;
    visited++;
    for (const child of outgoing.get(id) ?? []) {
      const next = (incoming.get(child) ?? 0) - 1;
      incoming.set(child, next);
      if (next === 0) queue.push(child);
    }
  }
  if (visited < nodeIds.size) {
    return {
      ok: false,
      issues: [
        {
          code: "CYCLE_DETECTED",
          message: "workflow contains a dependency cycle",
        },
      ],
    };
  }

  return {
    ok: true,
    workflow: {
      name: raw.name as string,
      nodes: nodes.map((n) => ({
        id: n.id as string,
        type: n.type as string,
        config: (n.config as Record<string, unknown>) ?? {},
      })),
      edges: edges.map((e) => ({
        from: e.from as string,
        to: e.to as string,
      })),
    },
  };
}

export function createRunFromWorkflow(workflowId: string, def: WorkflowDefinition): RunView {
  const id = nextRunId();
  return {
    id,
    workflowName: def.name,
    status: "pending",
    startedAt: new Date().toISOString(),
    definition: def,
    nodes: allPending(def),
  };
}
