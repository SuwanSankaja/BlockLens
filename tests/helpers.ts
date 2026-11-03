import type { GraphBuildOptions, GraphData, GraphEdge, GraphNode } from "@/types/graph";

export const TXID = "a".repeat(64);
export const GENESIS = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa";

export const OPTS: GraphBuildOptions = {
  confirmedOnly: false,
  minValueSats: 0,
  hideTinyOutputs: false,
  tinyOutputThresholdSats: 1000,
  maxDepth: 2,
  maxNodes: 200,
  hideVisited: false,
};

export const node = (id: string, extra: Partial<GraphNode> = {}): GraphNode => ({
  id,
  type: id.startsWith("tx:") ? "transaction" : "address",
  label: id,
  raw: null,
  metadata: {},
  ...extra,
});

export const edge = (
  id: string,
  from: string,
  to: string,
  extra: Partial<GraphEdge> = {},
): GraphEdge => ({ id, from, to, type: "output", metadata: {}, ...extra });

export function graph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  over: Partial<GraphData> = {},
): GraphData {
  return {
    nodes,
    edges,
    traversal: {
      rootNodeId: nodes[0]?.id ?? "",
      expandedNodeIds: [],
      nodeDepthById: {},
    },
    warnings: [],
    truncated: false,
    maxNodes: 200,
    ...over,
  };
}
