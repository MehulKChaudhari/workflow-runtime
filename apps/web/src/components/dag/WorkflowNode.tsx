import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { StatusPill } from "../StatusPill";
import { nodeBorderClass } from "../../lib/statusColors";
import type { NodeStatus } from "../../lib/types";

export interface WorkflowNodeData extends Record<string, unknown> {
  label: string;
  nodeType: string;
  status: NodeStatus;
  selected?: boolean;
}

function WorkflowNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as WorkflowNodeData;
  const isSelected = selected || nodeData.selected;

  return (
    <div
      className={[
        "min-w-[148px] max-w-[200px] rounded-xl border-2 bg-[var(--bg-elevated)] px-3 py-2.5 shadow-[var(--shadow-sm)] transition-all duration-300 sm:min-w-[200px] sm:px-4 sm:py-3",
        nodeBorderClass(nodeData.status),
        isSelected ? "ring-2 ring-[var(--accent-ring)] ring-offset-2 ring-offset-[var(--bg)]" : "",
      ].join(" ")}
    >
      <Handle type="target" position={Position.Left} className="!bg-[var(--border)] !w-2 !h-2" />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-sm font-medium text-[var(--text)]">
            {nodeData.label}
          </p>
          <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
            {nodeData.nodeType}
          </p>
        </div>
        <StatusPill status={nodeData.status} />
      </div>
      <Handle type="source" position={Position.Right} className="!bg-[var(--border)] !w-2 !h-2" />
    </div>
  );
}

export const WorkflowNode = memo(WorkflowNodeComponent);
