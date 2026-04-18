"use client";

import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import DetailsPanel from "@/components/DetailsPanel";
import FiltersPanel from "@/components/FiltersPanel";
import GraphView from "@/components/GraphView";
import SearchBar from "@/components/SearchBar";
import SummaryCards from "@/components/SummaryCards";
import { DEFAULT_GRAPH_OPTIONS, coerceGraphBuildOptions } from "@/lib/graph/buildGraph";
import { applyGraphFilters, buildSummaryCards } from "@/lib/graph/viewGraph";
import { detectBitcoinInputType } from "@/lib/utils/validateBitcoinInput";
import type { ErrorApiResponse, ExpandGraphResponse, GraphBuildOptions, SearchRouteResponse } from "@/types/graph";

/* ━━━ Animated Logo ━━━ */
function BlockLensLogo() {
  return (
    <div className="relative flex h-10 w-10 items-center justify-center">
      {/* Pulsing rings */}
      <div className="pulse-ring-1 absolute inset-0 rounded-full border border-sky-400/30" />
      <div className="pulse-ring-2 absolute inset-1 rounded-full border border-violet-400/25" />
      <div className="pulse-ring-3 absolute inset-2 rounded-full border border-cyan-400/20" />
      {/* Center icon: magnifying glass + block */}
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10"
      >
        <rect
          x="4"
          y="4"
          width="10"
          height="10"
          rx="2"
          stroke="url(#logo-grad)"
          strokeWidth="1.8"
          fill="rgba(96,168,255,0.08)"
        />
        <circle
          cx="14"
          cy="14"
          r="5"
          stroke="url(#logo-grad)"
          strokeWidth="1.8"
          fill="none"
        />
        <path
          d="M18 18L21 21"
          stroke="url(#logo-grad)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="logo-grad" x1="4" y1="4" x2="21" y2="21">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="50%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

/* ━━━ Status Chip ━━━ */
function StatusChip({
  children,
  variant = "info",
}: {
  children: React.ReactNode;
  variant?: "info" | "error" | "warning" | "loading";
}) {
  const styles: Record<string, string> = {
    info: "border-sky-400/20 bg-sky-500/10 text-sky-200",
    error: "border-rose-400/20 bg-rose-500/12 text-rose-200",
    warning: "border-amber-400/20 bg-amber-500/12 text-amber-200",
    loading: "border-violet-400/20 bg-violet-500/10 text-violet-200",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium backdrop-blur-sm ${styles[variant]}`}
    >
      {variant === "loading" ? (
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
      ) : null}
      {children}
    </span>
  );
}

export default function ExplorerApp({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const searchCacheRef = useRef(new Map<string, SearchRouteResponse>());
  const hasHydratedInitialQuery = useRef(false);
  const [query, setQuery] = useState(initialQuery.trim());
  const [filters, setFilters] = useState<GraphBuildOptions>(
    coerceGraphBuildOptions(DEFAULT_GRAPH_OPTIONS),
  );
  const [response, setResponse] = useState<SearchRouteResponse | null>(null);
  const [requestError, setRequestError] = useState<ErrorApiResponse["error"] | null>(
    null,
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expandingNodeId, setExpandingNodeId] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  const detection = useMemo(
    () => detectBitcoinInputType(deferredQuery),
    [deferredQuery],
  );
  const summary = response?.ok ? response.summary : null;
  const filteredGraph = useMemo(() => {
    if (!summary) {
      return null;
    }

    return applyGraphFilters(summary.graph, filters, selectedNodeId);
  }, [filters, selectedNodeId, summary]);
  const selectedNode = useMemo(() => {
    if (!summary || !selectedNodeId) {
      return null;
    }

    return summary.graph.nodes.find((node) => node.id === selectedNodeId) ?? null;
  }, [selectedNodeId, summary]);
  const summaryCards = useMemo(
    () => buildSummaryCards(summary, filteredGraph, filters.maxDepth),
    [filteredGraph, filters.maxDepth, summary],
  );
  const warnings = summary?.warnings ?? [];
  const searchError = requestError ?? (response && !response.ok ? response.error : null);

  function buildSearchParams(nextQuery: string, nextFilters: GraphBuildOptions): URLSearchParams {
    const params = new URLSearchParams();
    params.set("q", nextQuery.trim());
    params.set("confirmedOnly", String(nextFilters.confirmedOnly));
    params.set("minValueSats", String(nextFilters.minValueSats));
    params.set("hideTinyOutputs", String(nextFilters.hideTinyOutputs));
    params.set(
      "tinyOutputThresholdSats",
      String(nextFilters.tinyOutputThresholdSats),
    );
    params.set("maxDepth", String(nextFilters.maxDepth));
    params.set("maxNodes", String(nextFilters.maxNodes));
    params.set("hideVisited", String(nextFilters.hideVisited));
    return params;
  }

  function buildCacheKey(nextQuery: string, nextFilters: GraphBuildOptions): string {
    return JSON.stringify({
      q: nextQuery.trim(),
      confirmedOnly: nextFilters.confirmedOnly,
      minValueSats: nextFilters.minValueSats,
      hideTinyOutputs: nextFilters.hideTinyOutputs,
      tinyOutputThresholdSats: nextFilters.tinyOutputThresholdSats,
      maxDepth: nextFilters.maxDepth,
      maxNodes: nextFilters.maxNodes,
    });
  }

  const runSearch = useCallback(async (nextQuery: string) => {
    const normalizedQuery = nextQuery.trim();
    const localDetection = detectBitcoinInputType(normalizedQuery);

    setQuery(normalizedQuery);
    setRequestError(null);

    if (!normalizedQuery) {
      setResponse(null);
      setSelectedNodeId(null);
      startTransition(() => {
        router.replace("/", { scroll: false });
      });
      return;
    }

    if (!localDetection.isValid || localDetection.kind === "unknown") {
      setResponse(null);
      setRequestError({
        code: "invalid_input",
        message: localDetection.reason ?? "Invalid Bitcoin input.",
        status: 400,
      });
      return;
    }

    setIsLoading(true);
    const cacheKey = buildCacheKey(normalizedQuery, filters);
    const cached = searchCacheRef.current.get(cacheKey);

    if (cached) {
      setResponse(cached);
      setRequestError(cached.ok ? null : cached.error);
      if (cached.ok) {
        setSelectedNodeId(cached.summary.graph.traversal.rootNodeId);
      }
      setIsLoading(false);
      startTransition(() => {
        router.replace(`/?q=${encodeURIComponent(normalizedQuery)}`, {
          scroll: false,
        });
      });
      return;
    }

    try {
      const route = `/api/search?${buildSearchParams(normalizedQuery, filters).toString()}`;
      const result = (await fetch(route, {
        method: "GET",
        cache: "no-store",
      }).then((res) => res.json())) as SearchRouteResponse;

      searchCacheRef.current.set(cacheKey, result);
      setResponse(result);
      setRequestError(result.ok ? null : result.error);

      if (result.ok) {
        setSelectedNodeId(result.summary.graph.traversal.rootNodeId);
      }

      startTransition(() => {
        router.replace(`/?q=${encodeURIComponent(normalizedQuery)}`, {
          scroll: false,
        });
      });
    } catch (error) {
      setRequestError({
        code: "client_fetch_error",
        message:
          error instanceof Error ? error.message : "Failed to query the local API routes.",
        status: 500,
        retryable: true,
      });
    } finally {
      setIsLoading(false);
    }
  }, [filters, router]);

  const expandNode = useCallback(
    async (nodeId: string, nodeType: "transaction" | "address") => {
      if (!summary) {
        return;
      }

      setExpandingNodeId(nodeId);
      setRequestError(null);

      try {
        const result = (await fetch("/api/expand", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            targetNodeId: nodeId,
            targetNodeType: nodeType,
            graph: summary.graph,
            options: filters,
          }),
        }).then((res) => res.json())) as ExpandGraphResponse | ErrorApiResponse;

        if ("ok" in result && result.ok) {
          const nextResponse: SearchRouteResponse = {
            ok: true,
            summary: {
              ...summary,
              graph: result.graph,
              warnings: [
                ...summary.warnings,
                ...result.warnings.filter(
                  (warning) =>
                    !summary.warnings.some(
                      (existing) =>
                        existing.code === warning.code &&
                        existing.message === warning.message,
                    ),
                ),
              ],
              provider: result.provider,
            },
          };
          const cacheKey = buildCacheKey(query, filters);
          searchCacheRef.current.set(cacheKey, nextResponse);
          setResponse(nextResponse);
        } else {
          setRequestError(result.error);
        }
      } catch (error) {
        setRequestError({
          code: "client_expand_error",
          message:
            error instanceof Error ? error.message : "Failed to expand the selected graph node.",
          status: 500,
          retryable: true,
        });
      } finally {
        setExpandingNodeId(null);
      }
    },
    [filters, query, summary],
  );

  useEffect(() => {
    if (!initialQuery || hasHydratedInitialQuery.current) {
      return;
    }

    hasHydratedInitialQuery.current = true;
    void runSearch(initialQuery);
  }, [initialQuery, runSearch]);

  return (
    <div className="relative h-screen overflow-hidden">
      {/* Ambient orbs */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-sky-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute -right-32 top-16 h-80 w-80 rounded-full bg-violet-500/8 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-blue-600/8 blur-[100px]" />

      <div className="flex h-full flex-col">
        {/* ── Glassmorphic Header ── */}
        <header className="glass z-50 flex-shrink-0 border-b border-white/[0.04]">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-2 sm:px-6">
            <div className="flex items-center gap-3">
              <BlockLensLogo />
              <h1 className="gradient-text text-xl font-bold tracking-tight sm:text-2xl">
                BlockLens
              </h1>
            </div>

            {/* Status Chips + warnings inline */}
            <div className="flex flex-wrap items-center gap-2">
              {isLoading ? <StatusChip variant="loading">Fetching data</StatusChip> : null}
              {searchError ? (
                <StatusChip variant="error">
                  {searchError.code === "invalid_input" ? "Invalid input" : searchError.message}
                </StatusChip>
              ) : null}
              {warnings.length > 0 && !isLoading && !searchError ? (
                <StatusChip variant="warning">{warnings[0].message.length > 60 ? warnings[0].message.slice(0, 57) + "…" : warnings[0].message}</StatusChip>
              ) : null}
              {summary ? (
                <StatusChip variant="info">
                  {summary.provider === "esplora" ? "Esplora" : "Mempool"}
                </StatusChip>
              ) : null}
            </div>
          </div>
        </header>

        {/* ── Main Content (fills remaining viewport) ── */}
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-2 overflow-hidden px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex-shrink-0">
            <SummaryCards items={summaryCards} />
          </div>

          {isLoading && !summary ? (
            <section className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[340px_minmax(0,1fr)_360px]">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`skeleton:${index}`}
                  className={`panel shimmer rounded-3xl p-6 slide-up delay-${index + 1}`}
                >
                  <div className="h-5 w-32 rounded-full bg-slate-700/50" />
                  <div className="mt-4 h-4 w-48 rounded-full bg-slate-700/40" />
                  <div className="mt-3 h-48 rounded-2xl bg-slate-800/50" />
                </div>
              ))}
            </section>
          ) : (
            <section className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[340px_minmax(0,1fr)_360px]">
              <div className="scrollbar-thin min-h-0 space-y-2 overflow-y-auto">
                <div className="search-panel panel relative overflow-hidden rounded-3xl p-4">
                  <SearchBar
                    query={query}
                    detection={detection}
                    isLoading={isLoading}
                    onQueryChange={setQuery}
                    onSubmit={(value) => {
                      void runSearch(value);
                    }}
                  />
                </div>

                <div className="panel rounded-3xl p-4 slide-up delay-1">
                  <FiltersPanel
                    filters={filters}
                    onChange={(next) =>
                      setFilters((previous) => coerceGraphBuildOptions({ ...previous, ...next }))
                    }
                  />
                </div>
              </div>

              <GraphView
                graph={filteredGraph}
                selectedNode={selectedNode}
                selectedNodeId={selectedNodeId}
                expandingNodeId={expandingNodeId}
                maxDepth={filters.maxDepth}
                onSelectNode={setSelectedNodeId}
                onExpandNode={(nodeId, nodeType) => {
                  void expandNode(nodeId, nodeType);
                }}
              />

              <DetailsPanel
                graph={summary?.graph ?? null}
                selectedNode={selectedNode}
                provider={summary?.provider ?? null}
                expandingNodeId={expandingNodeId}
                maxDepth={filters.maxDepth}
                onExpandNode={(nodeId, nodeType) => {
                  void expandNode(nodeId, nodeType);
                }}
                onSelectNode={setSelectedNodeId}
              />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
