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
    <div className="relative min-h-screen overflow-hidden p-4 sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute left-0 top-0 h-72 w-72 rounded-full bg-sky-500/18 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-24 h-80 w-80 rounded-full bg-blue-600/16 blur-3xl" />
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl flex-col gap-4 lg:min-h-[calc(100vh-4rem)]">
        <header className="panel relative overflow-hidden rounded-[2rem] p-6">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-sky-400/12 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-px w-1/2 bg-gradient-to-r from-transparent via-sky-300/40 to-transparent" />
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-200/70">
                On-Chain Explorer
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
                BlockLens Explorer
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                Search Bitcoin transactions and addresses, inspect connected activity, and
                expand blockchain relationships hop by hop.
              </p>
            </div>
            <div className="surface-muted max-w-md rounded-3xl px-4 py-3 text-xs leading-5 text-slate-300">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-200/65">
                Data Sources
              </div>
              Searches use public mempool.space data first, with Blockstream Esplora fallback
              when needed.
            </div>
          </div>
        </header>

        <section className="panel rounded-[2rem] px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-100">
                {isLoading
                  ? "Fetching blockchain data..."
                  : searchError
                    ? searchError.message
                    : warnings.length > 0
                      ? warnings[0].message
                      : "Search a Bitcoin transaction or address."}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {searchError
                  ? `HTTP ${searchError.status}${searchError.retryable ? " • retryable" : ""}`
                  : warnings.length > 1
                    ? `${warnings.length} warnings are active.`
                    : "Select a node to inspect connected activity and expand the graph."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {searchError ? (
                <span className="rounded-full border border-rose-300/20 bg-rose-500/15 px-3 py-1 text-xs font-medium text-rose-100">
                  Error
                </span>
              ) : null}
              {isLoading ? (
                <span className="rounded-full border border-sky-300/20 bg-sky-500/15 px-3 py-1 text-xs font-medium text-sky-100">
                  Loading
                </span>
              ) : null}
              {warnings.some((warning) => warning.message.toLowerCase().includes("rate")) ? (
                <span className="rounded-full border border-amber-300/20 bg-amber-400/14 px-3 py-1 text-xs font-medium text-amber-100">
                  Rate limit warning
                </span>
              ) : null}
            </div>
          </div>
        </section>

        <SummaryCards items={summaryCards} />

        {isLoading && !summary ? (
          <section className="grid flex-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)_360px]">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`skeleton:${index}`}
                className="panel animate-pulse rounded-[2rem] p-6"
              >
                <div className="h-5 w-32 rounded-full bg-slate-700/70" />
                <div className="mt-4 h-4 w-48 rounded-full bg-slate-700/70" />
                <div className="mt-3 h-48 rounded-[1.5rem] bg-slate-800/70" />
              </div>
            ))}
          </section>
        ) : (
          <section className="grid flex-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)_360px]">
            <div className="space-y-4">
              <div className="panel rounded-[2rem] p-6">
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

              <div className="panel rounded-[2rem] p-6">
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
  );
}
