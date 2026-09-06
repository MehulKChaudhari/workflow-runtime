import type { NodeStatus, RunStatus } from "./types";

export const statusTokens: Record<
  NodeStatus | RunStatus,
  { bg: string; text: string; ring: string; dot: string }
> = {
  pending: {
    bg: "bg-[var(--status-pending-bg)]",
    text: "text-[var(--status-pending-text)]",
    ring: "ring-[var(--status-pending-ring)]",
    dot: "bg-[var(--status-pending-dot)]",
  },
  ready: {
    bg: "bg-[var(--status-ready-bg)]",
    text: "text-[var(--status-ready-text)]",
    ring: "ring-[var(--status-ready-ring)]",
    dot: "bg-[var(--status-ready-dot)]",
  },
  running: {
    bg: "bg-[var(--status-running-bg)]",
    text: "text-[var(--status-running-text)]",
    ring: "ring-[var(--status-running-ring)]",
    dot: "bg-[var(--status-running-dot)]",
  },
  succeeded: {
    bg: "bg-[var(--status-succeeded-bg)]",
    text: "text-[var(--status-succeeded-text)]",
    ring: "ring-[var(--status-succeeded-ring)]",
    dot: "bg-[var(--status-succeeded-dot)]",
  },
  failed: {
    bg: "bg-[var(--status-failed-bg)]",
    text: "text-[var(--status-failed-text)]",
    ring: "ring-[var(--status-failed-ring)]",
    dot: "bg-[var(--status-failed-dot)]",
  },
  skipped: {
    bg: "bg-[var(--status-skipped-bg)]",
    text: "text-[var(--status-skipped-text)]",
    ring: "ring-[var(--status-skipped-ring)]",
    dot: "bg-[var(--status-skipped-dot)]",
  },
};

export function nodeBorderClass(status: NodeStatus): string {
  switch (status) {
    case "pending":
      return "border-[var(--status-pending-ring)]";
    case "ready":
      return "border-[var(--status-ready-ring)]";
    case "running":
      return "border-[var(--status-running-ring)] animate-pulse-soft";
    case "succeeded":
      return "border-[var(--status-succeeded-ring)]";
    case "failed":
      return "border-[var(--status-failed-ring)]";
    case "skipped":
      return "border-[var(--status-skipped-ring)] border-dashed bg-skipped-pattern";
  }
}
