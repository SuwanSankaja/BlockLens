import { shortenHash } from "@/lib/utils/format";
import type { BlockchainAddress, BlockchainTransaction } from "@/types/blockchain";
import type {
  GraphData,
  GraphEdge,
  GraphNode,
  GraphWarning,
} from "@/types/graph";

interface AddressReference {
  address: string;
  label: string;
  metadata: Record<string, unknown>;
}

export interface GraphAccumulator {
  nodeMap: Map<string, GraphNode>;
  edgeMap: Map<string, GraphEdge>;
  warnings: GraphWarning[];
  truncated: boolean;
  traversal: GraphData["traversal"];
  maxNodes: number;
}

export function getTransactionNodeId(txid: string): string {
  return `tx:${txid}`;
}

export function getAddressNodeId(address: string): string {
  return `address:${address}`;
}

export function stripNodePrefix(nodeId: string): string {
  return nodeId.includes(":") ? nodeId.slice(nodeId.indexOf(":") + 1) : nodeId;
}

export function createTransactionNode(
  txid: string,
  raw: BlockchainTransaction | null,
  metadata: Record<string, unknown> = {},
): GraphNode {
  const resolvedTxid = raw?.txid ?? txid;

  return {
    id: getTransactionNodeId(resolvedTxid),
    type: "transaction",
    label: shortenHash(resolvedTxid),
    raw,
    metadata: {
      txid: resolvedTxid,
      confirmed: raw?.status.confirmed ?? metadata.confirmed ?? false,
      ...metadata,
    },
  };
}

export function resolveAddressReference({
  txid,
  index,
  address,
  scriptpubkey,
  scriptpubkeyType,
  direction,
}: {
  txid: string;
  index: number;
  address?: string;
  scriptpubkey?: string;
  scriptpubkeyType?: string;
  direction: "input" | "output";
}): AddressReference {
  if (address) {
    return {
      address,
      label: shortenHash(address, 6),
      metadata: {
        address,
        synthetic: false,
      },
    };
  }

  const syntheticAddress = `script:${txid}:${direction}:${index}`;

  return {
    address: syntheticAddress,
    label: `script ${direction} ${index}`,
    metadata: {
      address: syntheticAddress,
      synthetic: true,
      scriptpubkey,
      scriptpubkeyType,
    },
  };
}

export function createAddressNode(
  address: string,
  raw: BlockchainAddress | null,
  metadata: Record<string, unknown> = {},
): GraphNode {
  const label =
    typeof metadata.label === "string" ? metadata.label : shortenHash(address, 6);

  return {
    id: getAddressNodeId(address),
    type: "address",
    label,
    raw,
    metadata: {
      address,
      ...metadata,
    },
  };
}

export function addWarning(acc: GraphAccumulator, warning: GraphWarning): void {
  if (
    acc.warnings.some(
      (existing) =>
        existing.code === warning.code && existing.message === warning.message,
    )
  ) {
    return;
  }

  acc.warnings.push(warning);
}

export function createGraphAccumulator(
  baseGraph?: GraphData,
  maxNodes = 200,
): GraphAccumulator {
  if (baseGraph) {
    return {
      nodeMap: new Map(baseGraph.nodes.map((node) => [node.id, node])),
      edgeMap: new Map(baseGraph.edges.map((edge) => [edge.id, edge])),
      warnings: [...baseGraph.warnings],
      truncated: baseGraph.truncated,
      traversal: {
        rootNodeId: baseGraph.traversal.rootNodeId,
        expandedNodeIds: [...baseGraph.traversal.expandedNodeIds],
        nodeDepthById: { ...baseGraph.traversal.nodeDepthById },
      },
      maxNodes: baseGraph.maxNodes,
    };
  }

  return {
    nodeMap: new Map(),
    edgeMap: new Map(),
    warnings: [],
    truncated: false,
    traversal: {
      rootNodeId: "",
      expandedNodeIds: [],
      nodeDepthById: {},
    },
    maxNodes,
  };
}

export function upsertNode(
  acc: GraphAccumulator,
  node: GraphNode,
  depth: number,
): boolean {
  const existing = acc.nodeMap.get(node.id);

  if (!existing && acc.nodeMap.size >= acc.maxNodes) {
    acc.truncated = true;
    addWarning(acc, {
      code: "node_limit_reached",
      message: `Graph expansion was truncated at ${acc.maxNodes} nodes.`,
    });
    return false;
  }

  const currentDepth = acc.traversal.nodeDepthById[node.id];
  acc.traversal.nodeDepthById[node.id] =
    typeof currentDepth === "number" ? Math.min(currentDepth, depth) : depth;

  if (!existing) {
    acc.nodeMap.set(node.id, node);
    return true;
  }

  acc.nodeMap.set(node.id, {
    ...existing,
    raw: existing.raw ?? node.raw,
    metadata: {
      ...existing.metadata,
      ...node.metadata,
    },
  });

  return true;
}

export function upsertEdge(acc: GraphAccumulator, edge: GraphEdge): void {
  const fromExists = acc.nodeMap.has(edge.from);
  const toExists = acc.nodeMap.has(edge.to);

  if (!fromExists || !toExists) {
    return;
  }

  const existing = acc.edgeMap.get(edge.id);

  if (existing) {
    acc.edgeMap.set(edge.id, {
      ...existing,
      value: existing.value ?? edge.value,
      metadata: {
        ...existing.metadata,
        ...edge.metadata,
      },
    });
    return;
  }

  acc.edgeMap.set(edge.id, edge);
}

export function markNodeExpanded(acc: GraphAccumulator, nodeId: string): void {
  if (!acc.traversal.expandedNodeIds.includes(nodeId)) {
    acc.traversal.expandedNodeIds.push(nodeId);
  }
}

export function finalizeGraph(acc: GraphAccumulator): GraphData {
  const nodes = [...acc.nodeMap.values()].sort((left, right) => {
    const leftDepth = acc.traversal.nodeDepthById[left.id] ?? 0;
    const rightDepth = acc.traversal.nodeDepthById[right.id] ?? 0;

    return leftDepth - rightDepth || left.type.localeCompare(right.type);
  });

  const edges = [...acc.edgeMap.values()];

  return {
    nodes,
    edges,
    traversal: acc.traversal,
    warnings: acc.warnings,
    truncated: acc.truncated,
    maxNodes: acc.maxNodes,
  };
}
