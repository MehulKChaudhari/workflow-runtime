import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { WorkflowNode, type WorkflowNodeData } from "./WorkflowNode";
import { computeLayeredLayout } from "../../lib/layout";
import type { NodeRunView, WorkflowDefinition } from "../../lib/types";

const nodeTypes = { workflow: WorkflowNode };

interface WorkflowDagProps {
  definition: WorkflowDefinition;
  nodeRuns: NodeRunView[];
  selectedNodeId?: string;
  onNodeSelect: (nodeId: string) => void;
}

export function WorkflowDag({
  definition,
  nodeRuns,
  selectedNodeId,
  onNodeSelect,
}: WorkflowDagProps) {
  const statusById = useMemo(
    () => new Map(nodeRuns.map((n) => [n.nodeId, n.status])),
    [nodeRuns],
  );

  const positions = useMemo(
    () => computeLayeredLayout(definition.nodes, definition.edges),
    [definition],
  );

  const nodes: Node[] = useMemo(
    () =>
      definition.nodes.map((n) => ({
        id: n.id,
        type: "workflow",
        position: positions.get(n.id) ?? { x: 0, y: 0 },
        data: {
          label: n.id,
          nodeType: n.type,
          status: statusById.get(n.id) ?? "pending",
          selected: n.id === selectedNodeId,
        },
      })),
    [definition.nodes, positions, statusById, selectedNodeId],
  );

  const edges: Edge[] = useMemo(
    () =>
      definition.edges.map((e, i) => {
        const targetStatus = statusById.get(e.to) ?? "pending";
        return {
          id: `e-${i}`,
          source: e.from,
          target: e.to,
          animated: targetStatus === "running" || targetStatus === "ready",
          style: {
            stroke: "var(--border)",
            strokeWidth: 1.5,
            strokeDasharray: targetStatus === "skipped" ? "6 4" : undefined,
          },
        };
      }),
    [definition.edges, statusById],
  );

  return (
    <div className="h-[min(70vh,520px)] min-h-[280px] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)] sm:min-h-[360px] lg:min-h-[520px]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.3}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        onNodeClick={(_, node) => onNodeSelect(node.id)}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} color="var(--border-subtle)" />
        <Controls
          showInteractive={false}
          className="!shadow-[var(--shadow-sm)] [&>button]:!h-7 [&>button]:!w-7 sm:[&>button]:!h-8 sm:[&>button]:!w-8"
        />
        <MiniMap
          className="!hidden sm:!block"
          nodeColor={(n) => {
            const status = (n.data as unknown as WorkflowNodeData).status;
            if (status === "succeeded") return "#10b981";
            if (status === "failed") return "#ef4444";
            if (status === "running") return "#f59e0b";
            return "#d6d3d1";
          }}
          maskColor="rgb(28 25 23 / 0.15)"
        />
      </ReactFlow>
    </div>
  );
}
