"use client";

import { MAX_GRAPH_DEPTH } from "@/lib/graph/buildGraph";
import type { GraphBuildOptions } from "@/types/graph";

interface FiltersPanelProps {
  filters: GraphBuildOptions;
  onChange: (next: Partial<GraphBuildOptions>) => void;
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl px-1 py-1.5">
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block text-sm font-medium text-slate-200">{label}</span>
        <span id={`${id}-desc`} className="mt-0.5 block text-xs leading-4 text-slate-400">
          {description}
        </span>
      </label>
      <span className="toggle-switch mt-0.5">
        <input
          id={id}
          type="checkbox"
          role="switch"
          aria-checked={checked}
          aria-describedby={`${id}-desc`}
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
      </span>
    </div>
  );
}

export default function FiltersPanel({
  filters,
  onChange,
}: FiltersPanelProps) {
  const depthOptions = Array.from({ length: MAX_GRAPH_DEPTH }, (_, index) => index + 1);

  return (
    <section className="space-y-4" aria-labelledby="filters-heading">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-sky-300">
          Filters
        </p>
        <h3 id="filters-heading" className="mt-1 text-base font-semibold tracking-tight text-slate-50">
          Keep the graph readable
        </h3>
      </div>

      <div className="surface-muted space-y-3 rounded-2xl p-4">
        <ToggleRow
          id="filter-confirmed-only"
          label="Confirmed only"
          description="Hide transactions still in the mempool."
          checked={filters.confirmedOnly}
          onChange={(checked) => onChange({ confirmedOnly: checked })}
        />

        <div className="h-px bg-white/[0.08]" />

        <div className="flex flex-col gap-1.5 px-1 py-1.5">
          <label htmlFor="filter-min-value" className="text-sm font-medium text-slate-200">
            Minimum value (sats)
          </label>
          <input
            id="filter-min-value"
            type="number"
            min={0}
            step={1}
            value={filters.minValueSats}
            onChange={(event) =>
              onChange({ minValueSats: Number(event.target.value || 0) })
            }
            className="styled-number surface rounded-xl px-3 py-2 text-sm text-slate-100 outline-none transition focus-visible:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-400/60"
          />
        </div>

        <div className="h-px bg-white/[0.08]" />

        <ToggleRow
          id="filter-hide-tiny"
          label="Hide tiny outputs"
          description="Drop dust-sized edges to reduce clutter."
          checked={filters.hideTinyOutputs}
          onChange={(checked) => onChange({ hideTinyOutputs: checked })}
        />

        <div className="h-px bg-white/[0.08]" />

        <div className="flex flex-col gap-1.5 px-1 py-1.5">
          <label htmlFor="filter-max-depth" className="text-sm font-medium text-slate-200">
            Max expansion depth
          </label>
          <select
            id="filter-max-depth"
            value={filters.maxDepth}
            onChange={(event) =>
              onChange({ maxDepth: Number(event.target.value) })
            }
            className="styled-select surface rounded-xl px-3 py-2 text-sm text-slate-100 outline-none transition focus-visible:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-400/60"
          >
            {depthOptions.map((depth) => (
              <option key={depth} value={depth}>
                {depth} {depth === 1 ? "hop" : "hops"}
              </option>
            ))}
          </select>
        </div>

        <div className="h-px bg-white/[0.08]" />

        <ToggleRow
          id="filter-hide-visited"
          label="Hide visited nodes"
          description="Hide nodes you have already expanded."
          checked={filters.hideVisited}
          onChange={(checked) => onChange({ hideVisited: checked })}
        />
      </div>

      <div className="flex items-start gap-2.5 rounded-2xl border border-dashed border-sky-400/12 bg-sky-500/[0.04] p-3 text-xs leading-5 text-slate-400">
        <svg
          className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-300"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
        <span>
          Expands one hop at a time, up to {MAX_GRAPH_DEPTH} hops, capped at 200 visible
          nodes.
        </span>
      </div>
    </section>
  );
}
