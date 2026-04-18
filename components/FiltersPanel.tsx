"use client";

import { MAX_GRAPH_DEPTH } from "@/lib/graph/buildGraph";
import type { GraphBuildOptions } from "@/types/graph";

interface FiltersPanelProps {
  filters: GraphBuildOptions;
  onChange: (next: Partial<GraphBuildOptions>) => void;
}

export default function FiltersPanel({
  filters,
  onChange,
}: FiltersPanelProps) {
  const depthOptions = Array.from({ length: MAX_GRAPH_DEPTH }, (_, index) => index + 1);

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-200/65">
          Filters
        </p>
        <h3 className="mt-2 text-lg font-semibold text-slate-50">
          Keep the graph readable
        </h3>
      </div>

      <div className="surface-muted space-y-3 rounded-3xl p-4">
        <label className="flex items-center justify-between gap-4 text-sm text-slate-300">
          <span>Confirmed only</span>
          <input
            type="checkbox"
            checked={filters.confirmedOnly}
            onChange={(event) => onChange({ confirmedOnly: event.target.checked })}
            className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-500 focus:ring-sky-500"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-300">
          <span>Minimum value (sats)</span>
          <input
            type="number"
            min={0}
            step={1}
            value={filters.minValueSats}
            onChange={(event) =>
              onChange({ minValueSats: Number(event.target.value || 0) })
            }
            className="surface rounded-2xl px-3 py-2 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
          />
        </label>

        <label className="flex items-center justify-between gap-4 text-sm text-slate-300">
          <span>Hide tiny outputs</span>
          <input
            type="checkbox"
            checked={filters.hideTinyOutputs}
            onChange={(event) =>
              onChange({ hideTinyOutputs: event.target.checked })
            }
            className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-500 focus:ring-sky-500"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-300">
          <span>Max expansion depth</span>
          <select
            value={filters.maxDepth}
            onChange={(event) =>
              onChange({ maxDepth: Number(event.target.value) })
            }
            className="surface rounded-2xl px-3 py-2 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
          >
            {depthOptions.map((depth) => (
              <option key={depth} value={depth}>
                {depth} {depth === 1 ? "hop" : "hops"}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center justify-between gap-4 text-sm text-slate-300">
          <span>Hide already visited nodes</span>
          <input
            type="checkbox"
            checked={filters.hideVisited}
            onChange={(event) => onChange({ hideVisited: event.target.checked })}
            className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-sky-500 focus:ring-sky-500"
          />
        </label>
      </div>

      <div className="rounded-3xl border border-dashed border-sky-400/20 bg-sky-500/8 p-4 text-xs leading-5 text-slate-400">
        The graph expands one hop at a time, supports up to {MAX_GRAPH_DEPTH} hops, and caps
        rendering at 200 visible nodes to keep exploration responsive.
      </div>
    </section>
  );
}
