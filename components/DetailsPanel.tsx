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

/* ━━━ Copy Button with icon animation ━━━ */
function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }}
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/50 bg-slate-900/50 px-3 py-1.5 text-xs font-medium text-slate-300 backdrop-blur-sm transition hover:border-sky-400/30 hover:bg-slate-800/50 hover:text-sky-200"
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
          Copy
        </>
      )}
    </button>
  );
}

/* ━━━ Detail Badge ━━━ */
function DetailBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-sky-400/12 bg-sky-500/8 px-2.5 py-1 text-[11px] font-medium text-sky-200">
      {children}
    </span>
  );
}

/* ━━━ Collapsible Section ━━━ */
function CollapsibleSection({
  title,
  defaultOpen = true,
  accentColor = "sky",
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  accentColor?: string;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const accentMap: Record<string, string> = {
    sky: "bg-sky-400",
    amber: "bg-amber-400",
    cyan: "bg-cyan-400",
    violet: "bg-violet-400",
    rose: "bg-rose-400",
  };

  return (
    <section>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2.5 py-1 text-left"
      >
        <div className={`h-4 w-0.5 rounded-full ${accentMap[accentColor] ?? accentMap.sky}`} />
        <h3 className="flex-1 text-sm font-semibold text-slate-100">{title}</h3>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`collapsible-chevron text-slate-500 ${isOpen ? "rotated" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <div
        className={`collapsible-content mt-2 ${isOpen ? "" : "collapsed"}`}
        style={{ maxHeight: isOpen ? "2000px" : "0" }}
      >
        {children}
      </div>
    </section>
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
      <aside className="panel rounded-3xl p-5 slide-up">
        <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/8">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-sky-400/50">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-200">
            Select a node to inspect
          </p>
          <p className="mt-2 max-w-[240px] text-xs leading-5 text-slate-500">
            Click a node in the graph to see details, raw data, and connected activity.
          </p>
        </div>
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
    <aside className="panel scrollbar-thin rounded-3xl p-5 lg:max-h-[780px] lg:overflow-y-auto slide-up">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Details
          </p>
          <h2 className="mt-1.5 text-xl font-bold tracking-tight text-slate-50">
            {selectedNode.label}
          </h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <DetailBadge>{selectedNode.type}</DetailBadge>
            {selectedNode.metadata.heuristic ? <DetailBadge>heuristic</DetailBadge> : null}
            {selectedNode.metadata.synthetic ? <DetailBadge>synthetic</DetailBadge> : null}
            {selectedNode.metadata.placeholder ? <DetailBadge>placeholder</DetailBadge> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <CopyButton value={headlineValue} />
          {explorerUrl ? (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-slate-700/50 bg-slate-900/50 px-3 py-1.5 text-xs font-medium text-slate-300 backdrop-blur-sm transition hover:border-sky-400/30 hover:bg-slate-800/50 hover:text-sky-200"
            >
              Explorer
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          ) : null}
        </div>
      </div>

      {/* Headline value */}
      <div className="surface-muted mt-5 rounded-2xl p-3.5">
        <p className="break-all text-sm font-medium leading-relaxed text-slate-200">{headlineValue}</p>
        <p className="mt-1.5 text-[11px] leading-4 text-slate-500">
          On-chain links only. Input-side address relationships are heuristic.
        </p>
      </div>

      <div className="mt-5 space-y-4">
        {rawTransaction ? (
          <>
            <CollapsibleSection title="Transaction summary" accentColor="sky">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="surface-muted rounded-2xl p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Status</p>
                  <p className="mt-1.5 text-sm font-semibold text-slate-100">
                    {rawTransaction.status.confirmed ? (
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        Confirmed
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                        Unconfirmed
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {formatDateTime(rawTransaction.status.block_time)}
                  </p>
                </div>
                <div className="surface-muted rounded-2xl p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Fee</p>
                  <p className="mt-1.5 text-sm font-semibold text-slate-100">
                    {formatSats(rawTransaction.fee)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {formatFeeRate(rawTransaction.fee, rawTransaction.weight)}
                  </p>
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title={`Inputs (${rawTransaction.vin.length})`} accentColor="amber">
              <div className="space-y-2">
                {rawTransaction.vin.slice(0, 8).map((vin, index) => (
                  <div key={`${vin.txid ?? "coinbase"}:${index}`} className="flex items-start gap-2.5 rounded-xl border border-slate-700/40 bg-slate-950/30 p-2.5">
                    <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-amber-500/10">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
                        <path d="M12 5v14" />
                        <path d="m19 12-7 7-7-7" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-200">
                        {vin.prevout?.scriptpubkey_address ?? "Coinbase / script"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {formatBtc(vin.prevout?.value)} • heuristic
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            <CollapsibleSection title={`Outputs (${rawTransaction.vout.length})`} accentColor="cyan">
              <div className="space-y-2">
                {rawTransaction.vout.slice(0, 8).map((vout, index) => (
                  <div key={`${vout.scriptpubkey}:${index}`} className="flex items-start gap-2.5 rounded-xl border border-slate-700/40 bg-slate-950/30 p-2.5">
                    <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-cyan-500/10">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400">
                        <path d="M12 19V5" />
                        <path d="m5 12 7-7 7 7" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-200">
                        {vout.scriptpubkey_address ?? `Script output ${index}`}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {formatBtc(vout.value)} • {vout.scriptpubkey_type ?? "script"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          </>
        ) : null}

        {selectedNode.type === "transaction" && !rawTransaction ? (
          <div className="surface-muted rounded-2xl p-3.5">
            <h3 className="text-sm font-semibold text-slate-200">Partial transaction</h3>
            <p className="mt-1.5 text-xs leading-5 text-slate-500">
              Added as a neighbor. Expand to fetch full inputs, outputs, and outspends.
            </p>
          </div>
        ) : null}

        {rawAddress ? (
          <CollapsibleSection title="Address summary" accentColor="violet">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="surface-muted rounded-2xl p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Funded</p>
                <p className="mt-1.5 text-sm font-semibold text-slate-100">
                  {formatBtc(rawAddress.chain_stats.funded_txo_sum)}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {rawAddress.chain_stats.funded_txo_count} outputs
                </p>
              </div>
              <div className="surface-muted rounded-2xl p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Spent</p>
                <p className="mt-1.5 text-sm font-semibold text-slate-100">
                  {formatBtc(rawAddress.chain_stats.spent_txo_sum)}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {rawAddress.chain_stats.tx_count} chain txs
                </p>
              </div>
            </div>
          </CollapsibleSection>
        ) : null}

        {selectedNode.type === "address" && !rawAddress ? (
          <div className="surface-muted rounded-2xl p-3.5">
            <h3 className="text-sm font-semibold text-slate-200">Neighboring address</h3>
            <p className="mt-1.5 text-xs leading-5 text-slate-500">
              From a transaction neighborhood. May be a standard address or synthetic script placeholder.
            </p>
          </div>
        ) : null}

        {/* Connected nodes */}
        <CollapsibleSection title={`Connected nodes (${relatedNodes.length})`} accentColor="sky">
          <div className="mb-3 flex items-center justify-end">
            <button
              type="button"
              disabled={
                expandingNodeId === selectedNode.id ||
                graph?.traversal.expandedNodeIds.includes(selectedNode.id) ||
                (graph?.traversal.nodeDepthById[selectedNode.id] ?? 0) >= maxDepth
              }
              onClick={() => onExpandNode(selectedNode.id, selectedNode.type)}
              className="btn-glow rounded-full px-3.5 py-1.5 text-xs font-semibold"
            >
              {expandingNodeId === selectedNode.id ? (
                <span className="flex items-center gap-1.5">
                  <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                    <path d="M12 2a10 10 0 019.5 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Expanding…
                </span>
              ) : (
                "Expand 1 hop"
              )}
            </button>
          </div>
          <div className="space-y-1.5">
            {relatedNodes.length === 0 ? (
              <p className="py-3 text-center text-xs text-slate-500">No adjacent nodes visible.</p>
            ) : (
              relatedNodes.map(({ edge, node }) => (
                <button
                  key={`${edge.id}:${node.id}`}
                  type="button"
                  onClick={() => onSelectNode(node.id)}
                  className="group flex w-full items-center justify-between rounded-xl border border-slate-700/30 bg-slate-950/20 px-3 py-2.5 text-left transition hover:border-sky-400/25 hover:bg-slate-900/60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-200 group-hover:text-sky-200 transition-colors">
                      {node.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">
                      {edge.type} {typeof edge.value === "number" ? `• ${formatBtc(edge.value)}` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="rounded-full border border-sky-400/10 bg-sky-500/6 px-2 py-0.5 text-[10px] font-medium text-sky-300">
                      {node.type}
                    </span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600 transition-colors group-hover:text-sky-400">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </span>
                </button>
              ))
            )}
          </div>
        </CollapsibleSection>
      </div>
    </aside>
  );
}
