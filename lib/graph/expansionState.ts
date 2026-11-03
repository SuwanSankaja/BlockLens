import type { GraphData } from "@/types/graph";

export interface ExpansionState {
  canExpand: boolean;
  /** Human readable reason, present whenever canExpand is false (or loading). */
  reason: string | null;
  isExpanding: boolean;
}

/** Decides whether "Expand 1 hop" is available for a node and why not. */
export function getExpansionState(
  graph: GraphData | null,
  nodeId: string | null,
  maxDepth: number,
  expandingNodeId: string | null,
): ExpansionState {
  if (!graph || !nodeId) {
    return { canExpand: false, reason: "Select a node to expand it.", isExpanding: false };
  }

  if (expandingNodeId === nodeId) {
    return { canExpand: false, reason: "Expanding this node...", isExpanding: true };
  }

  if (expandingNodeId) {
    return {
      canExpand: false,
      reason: "Another expansion is in progress. Please wait.",
      isExpanding: false,
    };
  }

  if (graph.traversal.expandedNodeIds.includes(nodeId)) {
    return {
      canExpand: false,
      reason: "Already expanded: this node's direct neighbors are shown.",
      isExpanding: false,
    };
  }

  const node = graph.nodes.find((candidate) => candidate.id === nodeId);

  if (node?.metadata.synthetic) {
    return {
      canExpand: false,
      reason: "Script placeholders have no address to expand.",
      isExpanding: false,
    };
  }

  const depth = graph.traversal.nodeDepthById[nodeId] ?? 0;

  if (depth >= maxDepth) {
    return {
      canExpand: false,
      reason: `Depth limit reached (${maxDepth} ${maxDepth === 1 ? "hop" : "hops"}). Raise "Max expansion depth" in Filters to go further.`,
      isExpanding: false,
    };
  }

  if (graph.nodes.length >= graph.maxNodes) {
    return {
      canExpand: false,
      reason: `Node limit reached (${graph.maxNodes}).`,
      isExpanding: false,
    };
  }

  return { canExpand: true, reason: null, isExpanding: false };
}
