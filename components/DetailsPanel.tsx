"use client";

import { useMemo, useState } from "react";

import { formatBtc, formatDateTime, formatFeeRate, formatSats } from "@/lib/utils/format";
import type {
  BlockchainAddress,
  BlockchainTransaction,
  ProviderName,
} from "@/types/blockchain";
import type { GraphData, GraphNode, GraphNodeType } from "@/types/graph";

interface DetailsPanelProps {
  graph: GraphData | null;
  selectedNode: GraphNode | null;
  provider: ProviderName | null;
  expandingNodeId: string | null;
  maxDepth: number;
  onExpandNode: (nodeId: string, nodeType: GraphNodeType) => void;
  onSelectNode: (nodeId: string) => void;
}

function getExplorerUrl(
  provider: ProviderName | null,
  node: GraphNode,
): string | null {
  const baseUrl =
    provider === "esplora" ? "https://blockstream.info" : "https://mempool.space";
  const value =
    typeof node.metadata.address === "string"
      ? node.metadata.address
      : typeof node.metadata.txid === "string"
        ? node.metadata.txid
        : node.id;

  if (node.type === "address" && String(value).startsWith("script:")) {
    return null;
  }

  return node.type === "transaction"
    ? `${baseUrl}/tx/${value}`
    : `${baseUrl}/address/${value}`;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-sky-400/40 hover:bg-slate-800"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function DetailBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-sky-400/16 bg-sky-500/10 px-2.5 py-1 text-[11px] font-medium text-sky-100">
      {children}
    </span>
  );
}

export default function DetailsPanel({
  graph,
  selectedNode,
  provider,
  expandingNodeId,
  maxDepth,
  onExpandNode,
  onSelectNode,
}: DetailsPanelProps) {
  const relatedNodes = useMemo(() => {
    if (!graph || !selectedNode) {
      return [];
    }

    const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));

    return graph.edges
      .filter((edge) => edge.from === selectedNode.id || edge.to === selectedNode.id)
      .map((edge) => {
        const otherId = edge.from === selectedNode.id ? edge.to : edge.from;

        return {
          edge,
          node: nodeMap.get(otherId),
        };
      })
      .filter((item): item is { edge: GraphData["edges"][number]; node: GraphNode } =>
        Boolean(item.node),
      )
      .slice(0, 10);
  }, [graph, selectedNode]);

  if (!selectedNode) {
    return (
      <aside className="panel rounded-[2rem] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Details
        </p>
        <h2 className="mt-3 text-xl font-semibold text-slate-50">
          Select a node to inspect it
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          You’ll see raw transaction or address details here, plus any heuristic notes for
          inferred input relationships.
        </p>
      </aside>
    );
  }

  const explorerUrl = getExplorerUrl(provider, selectedNode);
  const rawTransaction =
    selectedNode.type === "transaction"
      ? (selectedNode.raw as BlockchainTransaction | null)
      : null;
  const rawAddress =
    selectedNode.type === "address"
      ? (selectedNode.raw as BlockchainAddress | null)
      : null;
  const headlineValue =
    typeof selectedNode.metadata.txid === "string"
      ? selectedNode.metadata.txid
      : typeof selectedNode.metadata.address === "string"
        ? selectedNode.metadata.address
        : selectedNode.label;

  return (
    <aside className="panel scrollbar-thin rounded-[2rem] p-6 lg:max-h-[780px] lg:overflow-y-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Details
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-50">
            {selectedNode.label}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <DetailBadge>{selectedNode.type}</DetailBadge>
            {selectedNode.metadata.heuristic ? <DetailBadge>heuristic</DetailBadge> : null}
            {selectedNode.metadata.synthetic ? <DetailBadge>synthetic script node</DetailBadge> : null}
            {selectedNode.metadata.placeholder ? <DetailBadge>placeholder</DetailBadge> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton value={headlineValue} />
          {explorerUrl ? (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-sky-400/40 hover:bg-slate-800"
            >
              Open explorer
            </a>
          ) : null}
        </div>
      </div>

      <div className="surface-muted mt-6 rounded-3xl p-4">
        <p className="break-all text-sm font-medium text-slate-100">{headlineValue}</p>
        <p className="mt-2 text-xs leading-5 text-slate-400">
          BlockLens only shows on-chain links. Input-side address relationships are inferred
          from prevouts and should be treated as heuristics, not ownership claims.
        </p>
      </div>

      <div className="mt-6 space-y-6">
        {rawTransaction ? (
          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-50">Transaction summary</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="surface-muted rounded-3xl p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Status</p>
                <p className="mt-2 text-sm font-medium text-slate-100">
                  {rawTransaction.status.confirmed ? "Confirmed" : "Unconfirmed"}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {formatDateTime(rawTransaction.status.block_time)}
                </p>
              </div>
              <div className="surface-muted rounded-3xl p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Fee</p>
                <p className="mt-2 text-sm font-medium text-slate-100">
                  {formatSats(rawTransaction.fee)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {formatFeeRate(rawTransaction.fee, rawTransaction.weight)}
                </p>
              </div>
            </div>

            <div className="surface-muted rounded-3xl p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Inputs</p>
              <div className="mt-3 space-y-3">
                {rawTransaction.vin.slice(0, 8).map((vin, index) => (
                  <div key={`${vin.txid ?? "coinbase"}:${index}`} className="rounded-2xl border border-slate-700/70 bg-slate-950/45 p-3">
                    <p className="text-sm font-medium text-slate-100">
                      {vin.prevout?.scriptpubkey_address ?? "Coinbase / script input"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {formatBtc(vin.prevout?.value)} • heuristic link
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-muted rounded-3xl p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Outputs</p>
              <div className="mt-3 space-y-3">
                {rawTransaction.vout.slice(0, 8).map((vout, index) => (
                  <div key={`${vout.scriptpubkey}:${index}`} className="rounded-2xl border border-slate-700/70 bg-slate-950/45 p-3">
                    <p className="text-sm font-medium text-slate-100">
                      {vout.scriptpubkey_address ?? `Script output ${index}`}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {formatBtc(vout.value)} • {vout.scriptpubkey_type ?? "script"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {selectedNode.type === "transaction" && !rawTransaction ? (
          <section className="surface-muted rounded-3xl p-4">
            <h3 className="text-lg font-semibold text-slate-50">Partial transaction node</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              This transaction was added as a neighboring spender. Expand it to fetch its full
              inputs, outputs, and outspend relationships.
            </p>
          </section>
        ) : null}

        {rawAddress ? (
          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-50">Address summary</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="surface-muted rounded-3xl p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Funded</p>
                <p className="mt-2 text-sm font-medium text-slate-100">
                  {formatBtc(rawAddress.chain_stats.funded_txo_sum)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {rawAddress.chain_stats.funded_txo_count} outputs
                </p>
              </div>
              <div className="surface-muted rounded-3xl p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Spent</p>
                <p className="mt-2 text-sm font-medium text-slate-100">
                  {formatBtc(rawAddress.chain_stats.spent_txo_sum)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {rawAddress.chain_stats.tx_count} chain transactions
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {selectedNode.type === "address" && !rawAddress ? (
          <section className="surface-muted rounded-3xl p-4">
            <h3 className="text-lg font-semibold text-slate-50">Neighboring address node</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              This address came from a transaction neighborhood. It may be a standard address or
              a synthetic script placeholder if no address string was present in the source data.
            </p>
          </section>
        ) : null}

        <section className="surface-muted rounded-3xl p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-slate-50">Connected nodes</h3>
            <button
              type="button"
              disabled={
                expandingNodeId === selectedNode.id ||
                graph?.traversal.expandedNodeIds.includes(selectedNode.id) ||
                (graph?.traversal.nodeDepthById[selectedNode.id] ?? 0) >= maxDepth
              }
              onClick={() => onExpandNode(selectedNode.id, selectedNode.type)}
              className="rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)] transition hover:from-sky-400 hover:to-blue-500 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400 disabled:shadow-none"
            >
              {expandingNodeId === selectedNode.id ? "Expanding..." : "Expand 1 hop"}
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {relatedNodes.length === 0 ? (
              <p className="text-sm text-slate-400">No adjacent nodes are currently visible.</p>
            ) : (
              relatedNodes.map(({ edge, node }) => (
                <button
                  key={`${edge.id}:${node.id}`}
                  type="button"
                  onClick={() => onSelectNode(node.id)}
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-700/80 bg-slate-950/35 px-3 py-3 text-left transition hover:border-sky-400/35 hover:bg-slate-900/80"
                >
                  <span>
                    <span className="block text-sm font-medium text-slate-100">{node.label}</span>
                    <span className="mt-1 block text-xs text-slate-400">
                      {edge.type} {typeof edge.value === "number" ? `• ${formatBtc(edge.value)}` : ""}
                    </span>
                  </span>
                  <span className="rounded-full border border-sky-400/16 bg-sky-500/10 px-2.5 py-1 text-[11px] font-medium text-sky-100">
                    {node.type}
                  </span>
                </button>
              ))
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}
