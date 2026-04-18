import { blockchainProvider } from "@/lib/blockchain/provider";
import {
  appendAddressNeighborhood,
  appendTransactionNeighborhood,
  coerceGraphBuildOptions,
} from "@/lib/graph/buildGraph";
import {
  addWarning,
  createGraphAccumulator,
  finalizeGraph,
  stripNodePrefix,
} from "@/lib/graph/normalize";
import type { AddressBundle, TransactionBundle } from "@/types/blockchain";
import type { ExpandGraphRequest, ExpandGraphResponse } from "@/types/graph";

export async function expandGraphOneHop(
  request: ExpandGraphRequest,
): Promise<ExpandGraphResponse> {
  const options = coerceGraphBuildOptions(request.options);
  const graph = request.graph;
  const acc = createGraphAccumulator(graph, options.maxNodes);

  if (graph.traversal.expandedNodeIds.includes(request.targetNodeId)) {
    addWarning(acc, {
      code: "already_expanded",
      message: "That node has already been expanded in this session.",
    });

    return {
      ok: true,
      graph: finalizeGraph(acc),
      provider: "mempool",
      warnings: acc.warnings,
    };
  }

  const currentDepth = graph.traversal.nodeDepthById[request.targetNodeId] ?? 0;

  if (currentDepth >= options.maxDepth) {
    addWarning(acc, {
      code: "depth_limit_reached",
      message: `Expansion depth limit reached at ${options.maxDepth} hop(s).`,
    });

    return {
      ok: true,
      graph: finalizeGraph(acc),
      provider: "mempool",
      warnings: acc.warnings,
    };
  }

  const context = blockchainProvider.createContext();

  if (request.targetNodeType === "transaction") {
    const txid = stripNodePrefix(request.targetNodeId);
    const [transactionResponse, outspendsResponse] = await Promise.all([
      blockchainProvider.getTransaction(txid, context),
      blockchainProvider.getTransactionOutspends(txid, context),
    ]);

    const bundle: TransactionBundle = {
      transaction: transactionResponse.data,
      outspends: outspendsResponse.data,
    };

    appendTransactionNeighborhood(acc, bundle, options, currentDepth, {
      isRoot: false,
    });

    return {
      ok: true,
      graph: finalizeGraph(acc),
      provider: transactionResponse.provider,
      warnings: acc.warnings,
    };
  }

  const address = stripNodePrefix(request.targetNodeId);
  const [addressResponse, transactionsResponse] = await Promise.all([
    blockchainProvider.getAddress(address, context),
    blockchainProvider.getAddressTransactions(address, context),
  ]);

  const bundle: AddressBundle = {
    address: addressResponse.data,
    transactions: transactionsResponse.data,
  };

  appendAddressNeighborhood(acc, bundle, options, currentDepth, {
    isRoot: false,
  });

  return {
    ok: true,
    graph: finalizeGraph(acc),
    provider: addressResponse.provider,
    warnings: acc.warnings,
  };
}
