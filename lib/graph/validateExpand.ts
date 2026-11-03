import { detectBitcoinInputType } from "@/lib/utils/validateBitcoinInput";
import { getAddressNodeId, getTransactionNodeId } from "@/lib/graph/normalize";
import type { ExpandGraphRequest } from "@/types/graph";

const MAX_REQUEST_NODES = 1000;
const MAX_REQUEST_EDGES = 20000;

export type ExpandValidationResult =
  | { ok: true; request: ExpandGraphRequest }
  | { ok: false; message: string };

/**
 * Validates an untrusted /api/expand body. The target id must be a canonical
 * `tx:<64 hex>` or `address:<valid address>` id matching the declared type, and
 * the posted graph must have a sane shape and size.
 */
export function validateExpandRequest(body: unknown): ExpandValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "Expand request is missing required fields." };
  }

  const candidate = body as Partial<ExpandGraphRequest>;
  const { targetNodeId, targetNodeType, graph } = candidate;

  if (typeof targetNodeId !== "string" || !targetNodeId) {
    return { ok: false, message: "targetNodeId is required." };
  }

  if (targetNodeType !== "transaction" && targetNodeType !== "address") {
    return { ok: false, message: "targetNodeType must be transaction or address." };
  }

  if (
    !graph ||
    typeof graph !== "object" ||
    !Array.isArray(graph.nodes) ||
    !Array.isArray(graph.edges) ||
    !graph.traversal ||
    !Array.isArray(graph.traversal.expandedNodeIds) ||
    typeof graph.traversal.nodeDepthById !== "object" ||
    graph.traversal.nodeDepthById === null
  ) {
    return { ok: false, message: "graph is missing or malformed." };
  }

  if (
    graph.traversal.expandedNodeIds.length > MAX_REQUEST_NODES ||
    Object.keys(graph.traversal.nodeDepthById).length > MAX_REQUEST_NODES ||
    graph.traversal.expandedNodeIds.some((id) => typeof id !== "string") ||
    Object.values(graph.traversal.nodeDepthById).some(
      (depth) => typeof depth !== "number" || !Number.isFinite(depth),
    )
  ) {
    return { ok: false, message: "graph traversal is malformed." };
  }

  const nodesValid = graph.nodes.every(
    (node) =>
      node &&
      typeof node.id === "string" &&
      (node.type === "transaction" || node.type === "address"),
  );
  const edgesValid = graph.edges.every(
    (edge) =>
      edge &&
      typeof edge.id === "string" &&
      typeof edge.from === "string" &&
      typeof edge.to === "string",
  );

  if (!nodesValid || !edgesValid) {
    return { ok: false, message: "graph nodes or edges are malformed." };
  }

  if (graph.nodes.length > MAX_REQUEST_NODES || graph.edges.length > MAX_REQUEST_EDGES) {
    return { ok: false, message: "graph is too large to expand." };
  }

  if (targetNodeType === "transaction") {
    const txid = targetNodeId.startsWith("tx:") ? targetNodeId.slice(3) : "";
    const detected = detectBitcoinInputType(txid);

    if (!detected.isValid || detected.kind !== "transaction") {
      return { ok: false, message: "targetNodeId is not a valid transaction node." };
    }

    if (targetNodeId !== getTransactionNodeId(txid)) {
      return { ok: false, message: "targetNodeId is not canonical." };
    }
  } else {
    const address = targetNodeId.startsWith("address:") ? targetNodeId.slice(8) : "";
    const detected = detectBitcoinInputType(address);

    if (!detected.isValid || detected.kind !== "address") {
      return { ok: false, message: "targetNodeId is not a valid address node." };
    }

    if (targetNodeId !== getAddressNodeId(address)) {
      return { ok: false, message: "targetNodeId is not canonical." };
    }
  }

  return { ok: true, request: candidate as ExpandGraphRequest };
}
