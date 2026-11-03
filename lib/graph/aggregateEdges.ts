import type { GraphEdge, GraphNode } from "@/types/graph";

export interface AggregatedEdgeMetadata {
  /** Number of raw edges merged into this one. */
  count: number;
  /** Sum of raw edge values in sats (0 when no raw edge carried a value). */
  totalValueSats: number;
  /** Ids of the raw edges merged into this one. */
  edgeIds: string[];
}

/**
 * Drops edges whose endpoints are not both in the provided node list, so the
 * renderer never draws lines towards nodes that do not exist.
 */
export function pruneDanglingEdges(
  nodes: Pick<GraphNode, "id">[],
  edges: GraphEdge[],
): GraphEdge[] {
  const nodeIds = new Set(nodes.map((node) => node.id));

  return edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));
}

/**
 * Merges parallel edges (same from, to and type) into one edge carrying
 * count / total value metadata. Edge order follows first occurrence.
 */
export function aggregateParallelEdges(edges: GraphEdge[]): GraphEdge[] {
  const groups = new Map<string, GraphEdge[]>();

  edges.forEach((edge) => {
    const key = `${edge.from}|${edge.to}|${edge.type}`;
    const group = groups.get(key);

    if (group) {
      group.push(edge);
    } else {
      groups.set(key, [edge]);
    }
  });

  return [...groups.entries()].map(([key, group]) => {
    const first = group[0];
    const totalValueSats = group.reduce(
      (sum, edge) => sum + (typeof edge.value === "number" ? edge.value : 0),
      0,
    );
    const hasValue = group.some((edge) => typeof edge.value === "number");
    const meta: AggregatedEdgeMetadata = {
      count: group.length,
      totalValueSats,
      edgeIds: group.map((edge) => edge.id),
    };

    if (group.length === 1) {
      return { ...first, metadata: { ...first.metadata, ...meta } };
    }

    return {
      id: `agg:${key}`,
      from: first.from,
      to: first.to,
      type: first.type,
      value: hasValue ? totalValueSats : undefined,
      metadata: {
        ...first.metadata,
        // A merged edge is "spent" only if every merged output is spent.
        spent: group.every((edge) => Boolean(edge.metadata.spent)),
        heuristic: group.every((edge) => Boolean(edge.metadata.heuristic)),
        ...meta,
      },
    };
  });
}

/** Short label such as "5x | 0.0123 BTC" (or just the value for single edges). */
export function formatAggregatedEdgeLabel(edge: GraphEdge): string {
  const count = typeof edge.metadata.count === "number" ? edge.metadata.count : 1;
  const value =
    typeof edge.value === "number"
      ? `${(edge.value / 100_000_000).toFixed(edge.value >= 1_000_000 ? 4 : 8)} BTC`
      : "";

  if (count > 1) {
    return value ? `${count}x | ${value}` : `${count}x`;
  }

  return value;
}
