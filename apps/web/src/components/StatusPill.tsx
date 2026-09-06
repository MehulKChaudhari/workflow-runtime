import type { NodeStatus, RunStatus } from "../lib/types";
import { statusTokens } from "../lib/statusColors";

interface StatusPillProps {
  status: NodeStatus | RunStatus;
  size?: "sm" | "md";
  pulse?: boolean;
}

export function StatusPill({ status, size = "sm", pulse }: StatusPillProps) {
  const tokens = statusTokens[status];
  const sizing =
    size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm";

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset",
        tokens.bg,
        tokens.text,
        tokens.ring,
        sizing,
        pulse || status === "running" ? "animate-pulse-soft" : "",
      ].join(" ")}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tokens.dot}`} />
      {status}
    </span>
  );
}
