import type { GraphData, GraphEdge, GraphNode } from "@/types/graph";

type LaneSide = "left" | "center" | "right";

export interface FocusPlacement {
  x: number;
  y: number;
  side: LaneSide;
  depth: number;
}

export interface FocusLaneBadge {
  id: string;
  label: string;
  side: Exclude<LaneSide, "center">;
}

export interface FocusLayoutResult {
  focusNodeId: string;
  placements: Record<string, FocusPlacement>;
  relativeDepthById: Record<string, number>;
  laneBadges: FocusLaneBadge[];
}

const X_STEP = 260;
const OUTER_X_STEP = 220;
const FAR_X_STEP = 160;
const Y_STEP = 118;
const DEEP_Y_STEP = 98;

function buildAdjacency(graph: GraphData): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();

  graph.nodes.forEach((node) => {
    adjacency.set(node.id, new Set());
  });

  graph.edges.forEach((edge) => {
    adjacency.get(edge.from)?.add(edge.to);
    adjacency.get(edge.to)?.add(edge.from);
  });

  return adjacency;
}

function buildEdgeLookup(graph: GraphData): Map<string, GraphEdge[]> {
  const lookup = new Map<string, GraphEdge[]>();

  graph.edges.forEach((edge) => {
    const key = [edge.from, edge.to].sort().join("::");
    const existing = lookup.get(key) ?? [];
    existing.push(edge);
    lookup.set(key, existing);
  });

  return lookup;
}

function getPairEdges(
  edgeLookup: Map<string, GraphEdge[]>,
  leftId: string,
  rightId: string,
): GraphEdge[] {
  return edgeLookup.get([leftId, rightId].sort().join("::")) ?? [];
}

function resolveDirectSide(
  focusNode: GraphNode,
  neighborNode: GraphNode,
  pairEdges: GraphEdge[],
): Exclude<LaneSide, "center"> {
  if (focusNode.type === "transaction") {
    if (
      pairEdges.some(
        (edge) =>
          edge.type === "input" &&
          edge.from === neighborNode.id &&
          edge.to === focusNode.id,
      )
    ) {
      return "left";
    }

    if (
      pairEdges.some(
        (edge) =>
          (edge.type === "output" ||
            edge.type === "received_by" ||
            edge.type === "spent_by") &&
          edge.from === focusNode.id &&
          edge.to === neighborNode.id,
      )
    ) {
      return "right";
    }
  }

  if (focusNode.type === "address") {
    if (
      pairEdges.some(
        (edge) => edge.from === neighborNode.id && edge.to === focusNode.id,
      )
    ) {
      return "left";
    }

    if (
      pairEdges.some(
        (edge) => edge.from === focusNode.id && edge.to === neighborNode.id,
      )
    ) {
      return "right";
    }
  }

  return pairEdges.some((edge) => edge.to === focusNode.id) ? "left" : "right";
}

function getLaneBadges(focusNode: GraphNode): FocusLaneBadge[] {
  if (focusNode.type === "transaction") {
    return [
      { id: "lane-left", label: "Inputs / upstream", side: "left" },
      { id: "lane-right", label: "Outputs / spenders", side: "right" },
    ];
  }

  return [
    { id: "lane-left", label: "Funding side", side: "left" },
    { id: "lane-right", label: "Spending side", side: "right" },
  ];
}

function computeRelativeDepths(
  adjacency: Map<string, Set<string>>,
  focusNodeId: string,
): Record<string, number> {
  const relativeDepthById: Record<string, number> = {
    [focusNodeId]: 0,
  };
  const queue: string[] = [focusNodeId];

  while (queue.length > 0) {
    const currentId = queue.shift();

    if (!currentId) {
      continue;
    }

    const currentDepth = relativeDepthById[currentId];
    const neighbors = adjacency.get(currentId) ?? new Set();

    neighbors.forEach((neighborId) => {
      if (relativeDepthById[neighborId] !== undefined) {
        return;
      }

      relativeDepthById[neighborId] = currentDepth + 1;
      queue.push(neighborId);
    });
  }

  return relativeDepthById;
}

function groupNodesBySideAndDepth(
  nodes: GraphNode[],
  sideById: Record<string, LaneSide>,
  relativeDepthById: Record<string, number>,
  focusNodeId: string,
  adjacency: Map<string, Set<string>>,
): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  nodes.forEach((node) => {
    if (node.id === focusNodeId) {
      return;
    }

    const side = sideById[node.id] ?? "right";
    const depth = Math.max(1, relativeDepthById[node.id] ?? 1);
    const key = `${side}:${depth}`;
    const group = groups.get(key) ?? [];
    group.push(node.id);
    groups.set(key, group);
  });

  groups.forEach((nodeIds) => {
    nodeIds.sort((leftId, rightId) => {
      const leftNode = nodes.find((node) => node.id === leftId);
      const rightNode = nodes.find((node) => node.id === rightId);
      const leftDegree = adjacency.get(leftId)?.size ?? 0;
      const rightDegree = adjacency.get(rightId)?.size ?? 0;

      if (rightDegree !== leftDegree) {
        return rightDegree - leftDegree;
      }

      if (leftNode?.type !== rightNode?.type) {
        return leftNode?.type === "transaction" ? -1 : 1;
      }

      return (leftNode?.label ?? "").localeCompare(rightNode?.label ?? "");
    });
  });

  return groups;
}

function getColumnX(depth: number): number {
  if (depth <= 1) {
    return X_STEP;
  }

  if (depth <= 4) {
    return X_STEP + (depth - 1) * OUTER_X_STEP;
  }

  return X_STEP + 3 * OUTER_X_STEP + (depth - 4) * FAR_X_STEP;
}

export function buildFocusLayout(
  graph: GraphData,
  requestedFocusNodeId: string,
): FocusLayoutResult {
  const focusNode =
    graph.nodes.find((node) => node.id === requestedFocusNodeId) ??
    graph.nodes.find((node) => node.id === graph.traversal.rootNodeId) ??
    graph.nodes[0];

  const focusNodeId = focusNode?.id ?? requestedFocusNodeId;
  const adjacency = buildAdjacency(graph);
  const edgeLookup = buildEdgeLookup(graph);
  const relativeDepthById = computeRelativeDepths(adjacency, focusNodeId);
  const sideById: Record<string, LaneSide> = {
    [focusNodeId]: "center",
  };

  const maxDepth = Math.max(...Object.values(relativeDepthById), 0);

  for (let depth = 1; depth <= maxDepth; depth += 1) {
    graph.nodes
      .filter((node) => relativeDepthById[node.id] === depth)
      .forEach((node) => {
        if (!focusNode) {
          sideById[node.id] = "right";
          return;
        }

        if (depth === 1) {
          sideById[node.id] = resolveDirectSide(
            focusNode,
            node,
            getPairEdges(edgeLookup, focusNodeId, node.id),
          );
          return;
        }

        const parentIds = [...(adjacency.get(node.id) ?? [])].filter(
          (neighborId) => (relativeDepthById[neighborId] ?? Infinity) === depth - 1,
        );
        const leftVotes = parentIds.filter(
          (parentId) => sideById[parentId] === "left",
        ).length;
        const rightVotes = parentIds.filter(
          (parentId) => sideById[parentId] === "right",
        ).length;

        if (leftVotes !== rightVotes) {
          sideById[node.id] = leftVotes > rightVotes ? "left" : "right";
          return;
        }

        const inherited = parentIds.find(
          (parentId) => sideById[parentId] !== "center",
        );
        sideById[node.id] = inherited
          ? (sideById[inherited] as Exclude<LaneSide, "center">)
          : "right";
      });
  }

  const placements: Record<string, FocusPlacement> = {
    [focusNodeId]: {
      x: 0,
      y: 0,
      side: "center",
      depth: 0,
    },
  };

  const groupedNodes = groupNodesBySideAndDepth(
    graph.nodes,
    sideById,
    relativeDepthById,
    focusNodeId,
    adjacency,
  );

  groupedNodes.forEach((nodeIds, key) => {
    const [side, depthToken] = key.split(":");
    const depth = Number(depthToken);
    const xMagnitude = getColumnX(depth);
    const x = side === "left" ? -xMagnitude : xMagnitude;
    const step = depth <= 1 ? Y_STEP : DEEP_Y_STEP;
    const totalHeight = step * Math.max(0, nodeIds.length - 1);

    nodeIds.forEach((nodeId, index) => {
      placements[nodeId] = {
        x,
        y: index * step - totalHeight / 2,
        side: side as LaneSide,
        depth,
      };
    });
  });

  return {
    focusNodeId,
    placements,
    relativeDepthById,
    laneBadges: focusNode ? getLaneBadges(focusNode) : [],
  };
}
