export type NodeStatus =
  | "pending"
  | "ready"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped";
export type RunStatus = "pending" | "running" | "succeeded" | "failed";

export interface NodeDefinition {
  id: string;
  type: string;
  config: Record<string, unknown>;
}
export interface EdgeDefinition {
  from: string;
  to: string;
}
export interface WorkflowDefinition {
  name: string;
  nodes: NodeDefinition[];
  edges: EdgeDefinition[];
}
export interface ValidationIssue {
  code: string;
  message: string;
  path?: string;
}
export interface NodeRunView {
  nodeId: string;
  status: NodeStatus;
  attempts: number;
  output?: Record<string, unknown>;
  error?: string;
}
export interface RunView {
  id: string;
  workflowName: string;
  status: RunStatus;
  startedAt: string;
  nodes: NodeRunView[];
  definition: WorkflowDefinition;
}

export interface RunSummary {
  id: string;
  workflowName: string;
  status: RunStatus;
  startedAt: string;
  totalNodes: number;
  succeededNodes: number;
}
