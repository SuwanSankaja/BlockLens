import type { GraphData, GraphNode } from "@/types/graph";

export interface CompactPlacement {
  x: number;
  y: number;
}

export interface CompactLayoutResult {
  focusNodeId: string;
  placements: Record<string, CompactPlacement>;
}

function centerSpread(ids: string[], step: number): number[] {
  const totalHeight = step * Math.max(0, ids.length - 1);

  return ids.map((_, index) => index * step - totalHeight / 2);
}

function sortNodesByLabel(ids: string[], nodeMap: Map<string, GraphNode>): string[] {
  return [...ids].sort((leftId, rightId) => {
    const leftNode = nodeMap.get(leftId);
    const rightNode = nodeMap.get(rightId);

    if (leftNode?.type !== rightNode?.type) {
      return leftNode?.type === "transaction" ? -1 : 1;
    }

    return (leftNode?.label ?? "").localeCompare(rightNode?.label ?? "");
  });
}

function buildTransactionCompactLayout(
  graph: GraphData,
  focusNodeId: string,
): CompactLayoutResult {
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const incoming = new Set<string>();
  const outgoingAddresses = new Set<string>();
  const outgoingTransactions = new Set<string>();
  const mixed = new Set<string>();

  graph.edges.forEach((edge) => {
    if (edge.to === focusNodeId && edge.from !== focusNodeId) {
      incoming.add(edge.from);
    }

    if (edge.from === focusNodeId && edge.to !== focusNodeId) {
      const neighbor = nodeMap.get(edge.to);

      if (neighbor?.type === "transaction" || edge.type === "spent_by") {
        outgoingTransactions.add(edge.to);
      } else {
        outgoingAddresses.add(edge.to);
      }
    }
  });

  [...incoming].forEach((nodeId) => {
    if (outgoingAddresses.has(nodeId) || outgoingTransactions.has(nodeId)) {
      mixed.add(nodeId);
      incoming.delete(nodeId);
      outgoingAddresses.delete(nodeId);
      outgoingTransactions.delete(nodeId);
    }
  });

  const placements: Record<string, CompactPlacement> = {
    [focusNodeId]: { x: 0, y: 0 },
  };

  const sortedIncoming = sortNodesByLabel([...incoming], nodeMap);
  const sortedMixed = sortNodesByLabel([...mixed], nodeMap);
  const sortedOutgoingAddresses = sortNodesByLabel([...outgoingAddresses], nodeMap);
  const sortedOutgoingTransactions = sortNodesByLabel(
    [...outgoingTransactions],
    nodeMap,
  );

  centerSpread(sortedIncoming, 150).forEach((y, index) => {
    placements[sortedIncoming[index]] = { x: -250, y };
  });

  centerSpread(sortedMixed, 130).forEach((y, index) => {
    placements[sortedMixed[index]] = { x: 260, y: y - 90 };
  });

  centerSpread(sortedOutgoingAddresses, 150).forEach((y, index) => {
    placements[sortedOutgoingAddresses[index]] = { x: 260, y: y + 80 };
  });

  centerSpread(sortedOutgoingTransactions, 150).forEach((y, index) => {
    placements[sortedOutgoingTransactions[index]] = { x: 0, y: y + 270 };
  });

  graph.nodes.forEach((node) => {
    if (placements[node.id]) {
      return;
    }

    placements[node.id] = { x: 0, y: -260 };
  });

  return {
    focusNodeId,
    placements,
  };
}

function buildAddressCompactLayout(
  graph: GraphData,
  focusNodeId: string,
): CompactLayoutResult {
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const incomingTransactions = new Set<string>();
  const outgoingTransactions = new Set<string>();
  const neighboringAddresses = new Set<string>();

  graph.edges.forEach((edge) => {
    if (edge.to === focusNodeId && edge.from !== focusNodeId) {
      const neighbor = nodeMap.get(edge.from);

      if (neighbor?.type === "transaction") {
        incomingTransactions.add(edge.from);
      } else {
        neighboringAddresses.add(edge.from);
      }
    }

    if (edge.from === focusNodeId && edge.to !== focusNodeId) {
      const neighbor = nodeMap.get(edge.to);

      if (neighbor?.type === "transaction") {
        outgoingTransactions.add(edge.to);
      } else {
        neighboringAddresses.add(edge.to);
      }
    }
  });

  const placements: Record<string, CompactPlacement> = {
    [focusNodeId]: { x: 0, y: 0 },
  };
  const sortedIncoming = sortNodesByLabel([...incomingTransactions], nodeMap);
  const sortedOutgoing = sortNodesByLabel([...outgoingTransactions], nodeMap);
  const sortedNeighbors = sortNodesByLabel([...neighboringAddresses], nodeMap);

  centerSpread(sortedIncoming, 160).forEach((y, index) => {
    placements[sortedIncoming[index]] = { x: -250, y };
  });

  centerSpread(sortedOutgoing, 160).forEach((y, index) => {
    placements[sortedOutgoing[index]] = { x: 250, y };
  });

  centerSpread(sortedNeighbors, 140).forEach((y, index) => {
    placements[sortedNeighbors[index]] = { x: 0, y: y + 250 };
  });

  graph.nodes.forEach((node) => {
    if (placements[node.id]) {
      return;
    }

    placements[node.id] = { x: 0, y: -250 };
  });

  return {
    focusNodeId,
    placements,
  };
}

export function buildCompactLayout(
  graph: GraphData,
  requestedFocusNodeId: string,
): CompactLayoutResult {
  const focusNode =
    graph.nodes.find((node) => node.id === requestedFocusNodeId) ??
    graph.nodes.find((node) => node.id === graph.traversal.rootNodeId) ??
    graph.nodes[0];
  const focusNodeId = focusNode?.id ?? requestedFocusNodeId;

  if (focusNode?.type === "transaction") {
    return buildTransactionCompactLayout(graph, focusNodeId);
  }

  return buildAddressCompactLayout(graph, focusNodeId);
}
