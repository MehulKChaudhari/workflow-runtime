import type { NodeDefinition, EdgeDefinition } from "./types";

export interface LayoutPosition {
  x: number;
  y: number;
}

/**
 * Layer nodes by longest path from roots so the DAG reads left-to-right.
 * Disconnected components stack vertically with a small gap.
 */
export function computeLayeredLayout(
  nodes: NodeDefinition[],
  edges: EdgeDefinition[],
  options?: { nodeWidth?: number; nodeHeight?: number; gapX?: number; gapY?: number },
): Map<string, LayoutPosition> {
  const nodeWidth = options?.nodeWidth ?? 220;
  const nodeHeight = options?.nodeHeight ?? 88;
  const gapX = options?.gapX ?? 72;
  const gapY = options?.gapY ?? 48;

  const incoming = new Map<string, Set<string>>();
  const outgoing = new Map<string, Set<string>>();
  for (const node of nodes) {
    incoming.set(node.id, new Set());
    outgoing.set(node.id, new Set());
  }
  for (const edge of edges) {
    incoming.get(edge.to)?.add(edge.from);
    outgoing.get(edge.from)?.add(edge.to);
  }

  const depth = new Map<string, number>();
  const queue: string[] = [];
  for (const node of nodes) {
    if ((incoming.get(node.id)?.size ?? 0) === 0) {
      depth.set(node.id, 0);
      queue.push(node.id);
    }
  }

  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) break;
    const currentDepth = depth.get(id) ?? 0;
    for (const child of outgoing.get(id) ?? []) {
      const next = currentDepth + 1;
      const prev = depth.get(child);
      if (prev === undefined || next > prev) {
        depth.set(child, next);
        queue.push(child);
      }
    }
  }

  for (const node of nodes) {
    if (!depth.has(node.id)) depth.set(node.id, 0);
  }

  const layers = new Map<number, string[]>();
  for (const node of nodes) {
    const layer = depth.get(node.id) ?? 0;
    const list = layers.get(layer) ?? [];
    list.push(node.id);
    layers.set(layer, list);
  }

  const positions = new Map<string, LayoutPosition>();
  const sortedLayers = [...layers.entries()].sort(([a], [b]) => a - b);

  for (const [, ids] of sortedLayers) {
    const sorted = [...ids].sort();
    for (let i = 0; i < sorted.length; i++) {
      const id = sorted[i];
      if (!id) continue;
      const layer = depth.get(id) ?? 0;
      positions.set(id, {
        x: layer * (nodeWidth + gapX),
        y: i * (nodeHeight + gapY),
      });
    }
  }

  return positions;
}
