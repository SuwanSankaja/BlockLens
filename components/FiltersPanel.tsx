"use client";

import { MAX_GRAPH_DEPTH } from "@/lib/graph/buildGraph";
import type { GraphBuildOptions } from "@/types/graph";

interface FiltersPanelProps {
  filters: GraphBuildOptions;
  onChange: (next: Partial<GraphBuildOptions>) => void;
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl px-1 py-1 text-sm text-slate-300 transition hover:text-slate-100">
      <span>{label}</span>
      <span className="toggle-switch">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
      </span>
    </label>
  );
}

export default function FiltersPanel({
  filters,
  onChange,
}: FiltersPanelProps) {
  const depthOptions = Array.from({ length: MAX_GRAPH_DEPTH }, (_, index) => index + 1);

  return (
    <section className="space-y-2.5">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-sky-300/50">
          Filters
        </p>
        <h3 className="mt-1 text-base font-semibold tracking-tight text-slate-50">
          Keep the graph readable
        </h3>
      </div>

      <div className="surface-muted space-y-1 rounded-2xl p-3">
        <ToggleRow
          label="Confirmed only"
          checked={filters.confirmedOnly}
          onChange={(checked) => onChange({ confirmedOnly: checked })}
        />

        <div className="my-2 h-px bg-white/[0.04]" />

        <label className="flex flex-col gap-1.5 px-1 py-1 text-sm text-slate-300">
          <span>Minimum value (sats)</span>
          <input
            type="number"
            min={0}
            step={1}
            value={filters.minValueSats}
            onChange={(event) =>
              onChange({ minValueSats: Number(event.target.value || 0) })
            }
            className="styled-number surface rounded-xl px-3 py-2 text-sm outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-400/15"
          />
        </label>

        <div className="my-2 h-px bg-white/[0.04]" />

        <ToggleRow
          label="Hide tiny outputs"
          checked={filters.hideTinyOutputs}
          onChange={(checked) => onChange({ hideTinyOutputs: checked })}
        />

        <div className="my-2 h-px bg-white/[0.04]" />

        <label className="flex flex-col gap-1.5 px-1 py-1 text-sm text-slate-300">
          <span>Max expansion depth</span>
          <select
            value={filters.maxDepth}
            onChange={(event) =>
              onChange({ maxDepth: Number(event.target.value) })
            }
            className="styled-select surface rounded-xl px-3 py-2 text-sm outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-400/15"
          >
            {depthOptions.map((depth) => (
              <option key={depth} value={depth}>
                {depth} {depth === 1 ? "hop" : "hops"}
              </option>
            ))}
          </select>
        </label>

        <div className="my-2 h-px bg-white/[0.04]" />

        <ToggleRow
          label="Hide visited nodes"
          checked={filters.hideVisited}
          onChange={(checked) => onChange({ hideVisited: checked })}
        />
      </div>

      <div className="flex items-start gap-2.5 rounded-2xl border border-dashed border-sky-400/12 bg-sky-500/[0.04] p-3 text-xs leading-5 text-slate-500">
        <svg
          className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-400/50"
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
