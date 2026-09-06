import type { NodeRunView, RunStatus } from "./types";

export function formatDuration(startedAt: string, endedAt = new Date()): string {
  const start = new Date(startedAt).getTime();
  const end = endedAt.getTime();
  const seconds = Math.max(0, Math.floor((end - start) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return `${minutes}m ${rem}s`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function countByStatus(nodes: NodeRunView[], status: NodeRunView["status"]): number {
  return nodes.filter((n) => n.status === status).length;
}

export function progressLabel(nodes: NodeRunView[]): string {
  const succeeded = countByStatus(nodes, "succeeded");
  return `${succeeded}/${nodes.length} succeeded`;
}

export function isRunTerminal(status: RunStatus): boolean {
  return status === "succeeded" || status === "failed";
}

export function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
