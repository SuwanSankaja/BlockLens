import type { GraphData, GraphNode } from "@/types/graph";

export interface OrbitPlacement {
  x: number;
  y: number;
}

export interface OrbitLayoutResult {
  focusNodeId: string;
  placements: Record<string, OrbitPlacement>;
}

function sortNodes(nodes: GraphNode[]): GraphNode[] {
  return [...nodes].sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === "transaction" ? -1 : 1;
    }

    return left.label.localeCompare(right.label);
  });
}

function placeRing(
  placements: Record<string, OrbitPlacement>,
  nodes: GraphNode[],
  radius: number,
  offsetRadians = -Math.PI / 2,
): void {
  const sorted = sortNodes(nodes);

  if (sorted.length === 0) {
    return;
  }

  const angleStep = (Math.PI * 2) / sorted.length;

  sorted.forEach((node, index) => {
    const angle = offsetRadians + index * angleStep;

    placements[node.id] = {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  });
}

export function buildOrbitLayout(
  graph: GraphData,
  requestedFocusNodeId: string,
): OrbitLayoutResult {
  const focusNode =
    graph.nodes.find((node) => node.id === requestedFocusNodeId) ??
    graph.nodes.find((node) => node.id === graph.traversal.rootNodeId) ??
    graph.nodes[0];
  const focusNodeId = focusNode?.id ?? requestedFocusNodeId;
  const placements: Record<string, OrbitPlacement> = {
    [focusNodeId]: {
      x: 0,
      y: 0,
    },
  };
  const peripheralNodes = graph.nodes.filter((node) => node.id !== focusNodeId);

  if (!focusNode) {
    placeRing(placements, peripheralNodes, 300);

    return {
      focusNodeId,
      placements,
    };
  }

  const transactionNodes = peripheralNodes.filter(
    (node) => node.type === "transaction",
  );
  const addressNodes = peripheralNodes.filter((node) => node.type === "address");
  const innerRingNodes =
    focusNode.type === "address" ? transactionNodes : addressNodes;
  const outerRingNodes =
    focusNode.type === "address" ? addressNodes : transactionNodes;

  placeRing(placements, innerRingNodes, 240);
  placeRing(placements, outerRingNodes, 420, -Math.PI / 2 + Math.PI / 10);

  return {
    focusNodeId,
    placements,
  };
}
