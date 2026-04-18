import type { SummaryCardItem } from "@/types/graph";
import type { GraphBuildOptions, GraphData, SearchSummary } from "@/types/graph";
import { formatBtc, formatFeeRate, formatSats, shortenHash } from "@/lib/utils/format";

function passesValueFilter(
  value: number | undefined,
  options: GraphBuildOptions,
): boolean {
  if (typeof value !== "number") {
    return true;
  }

  if (value < options.minValueSats) {
    return false;
  }

  if (options.hideTinyOutputs && value < options.tinyOutputThresholdSats) {
    return false;
  }

  return true;
}

export function applyGraphFilters(
  graph: GraphData,
  options: GraphBuildOptions,
  selectedNodeId: string | null,
): GraphData {
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const visibleNodeIds = new Set<string>([graph.traversal.rootNodeId]);

  if (selectedNodeId) {
    visibleNodeIds.add(selectedNodeId);
  }

  const filteredEdges = graph.edges.filter((edge) => {
    if (!passesValueFilter(edge.value, options)) {
      return false;
    }

    if (options.confirmedOnly) {
      const fromNode = nodeMap.get(edge.from);
      const toNode = nodeMap.get(edge.to);
      const txNodes = [fromNode, toNode].filter(
        (node) => node?.type === "transaction",
      );

      if (
        txNodes.some(
          (node) =>
            node &&
            node.id !== graph.traversal.rootNodeId &&
            node.metadata.confirmed !== true,
        )
      ) {
        return false;
      }
    }

    visibleNodeIds.add(edge.from);
    visibleNodeIds.add(edge.to);
    return true;
  });

  const hiddenVisited = new Set(graph.traversal.expandedNodeIds);
  const nodes = graph.nodes.filter((node) => {
    if (!visibleNodeIds.has(node.id)) {
      return false;
    }

    if (
      options.hideVisited &&
      hiddenVisited.has(node.id) &&
      node.id !== graph.traversal.rootNodeId &&
      node.id !== selectedNodeId
    ) {
      return false;
    }

    return true;
  });
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = filteredEdges.filter(
    (edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to),
  );

  return {
    ...graph,
    nodes,
    edges,
  };
}

export function buildSummaryCards(
  summary: SearchSummary | null,
  visibleGraph: GraphData | null,
  maxDepth: number,
): SummaryCardItem[] {
  if (!summary || !visibleGraph) {
    return [
      { label: "Mode", value: "Idle", hint: "Search for a Bitcoin txid or address." },
      { label: "Visible nodes", value: "0" },
      { label: "Visible edges", value: "0" },
      { label: "Depth", value: `0 / ${maxDepth}` },
    ];
  }

  const baseCards: SummaryCardItem[] = [
    { label: "Visible nodes", value: String(visibleGraph.nodes.length) },
    { label: "Visible edges", value: String(visibleGraph.edges.length) },
    {
      label: "Depth",
      value: `${Math.max(...Object.values(summary.graph.traversal.nodeDepthById), 0)} / ${maxDepth}`,
    },
    { label: "Provider", value: summary.provider },
  ];

  if (summary.kind === "transaction" && summary.transactionBundle) {
    const tx = summary.transactionBundle.transaction;

    return [
      {
        label: "Transaction",
        value: shortenHash(tx.txid),
        hint: tx.status.confirmed ? "Confirmed" : "Unconfirmed",
      },
      { label: "Fee", value: formatSats(tx.fee), hint: formatFeeRate(tx.fee, tx.weight) },
      {
        label: "Outputs",
        value: String(tx.vout.length),
        hint: formatBtc(tx.vout.reduce((sum, output) => sum + output.value, 0)),
      },
      baseCards[0],
    ];
  }

  if (summary.kind === "address" && summary.addressBundle) {
    const address = summary.addressBundle.address;

    return [
      {
        label: "Address",
        value: shortenHash(address.address, 6),
        hint: `${address.chain_stats.tx_count} chain txs`,
      },
      { label: "Funded", value: formatBtc(address.chain_stats.funded_txo_sum) },
      { label: "Spent", value: formatBtc(address.chain_stats.spent_txo_sum) },
      baseCards[0],
    ];
  }

  return baseCards;
}
