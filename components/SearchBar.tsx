"use client";

import { GENESIS_ADDRESS, GENESIS_TXID } from "@/lib/utils/presets";
import type { BitcoinInputDetection } from "@/lib/utils/validateBitcoinInput";

interface SearchBarProps {
  query: string;
  detection: BitcoinInputDetection;
  isLoading: boolean;
  onQueryChange: (value: string) => void;
  onSubmit: (value: string) => void;
}

const EXAMPLES = [
  {
    label: "Genesis tx",
    value: GENESIS_TXID,
  },
  {
    label: "Genesis address",
    value: GENESIS_ADDRESS,
  },
];

export default function SearchBar({
  query,
  detection,
  isLoading,
  onQueryChange,
  onSubmit,
}: SearchBarProps) {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-200/65">
          Search
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-50">
          Find a transaction or address
        </h2>
      </div>

      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(query);
        }}
      >
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-300">
            Bitcoin txid or address
          </span>
          <textarea
            rows={3}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Paste a txid or address"
            className="search-input surface min-h-28 w-full rounded-2xl px-4 py-3 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`rounded-full px-2.5 py-1 font-medium ${
              detection.kind === "transaction"
                ? "bg-sky-400/18 text-sky-100 ring-1 ring-sky-300/20"
                : detection.kind === "address"
                  ? "bg-cyan-400/16 text-cyan-100 ring-1 ring-cyan-300/20"
                  : "bg-amber-400/14 text-amber-100 ring-1 ring-amber-300/20"
            }`}
          >
            {detection.kind === "unknown"
              ? "Awaiting valid input"
              : `Likely ${detection.kind}`}
          </span>
          <span className="text-slate-400">
            {detection.reason ??
              "Basic format validation only. Ownership is never inferred."}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-[0_12px_24px_rgba(37,99,235,0.28)] transition hover:from-sky-400 hover:to-blue-500 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400 disabled:shadow-none"
          >
            {isLoading ? "Searching..." : "Search"}
          </button>
          {EXAMPLES.map((example) => (
            <button
              key={example.label}
              type="button"
              onClick={() => onSubmit(example.value)}
              className="rounded-full border border-slate-700/80 bg-slate-900/70 px-3 py-2 text-xs font-medium text-slate-200 transition hover:border-sky-400/40 hover:bg-slate-800"
            >
              {example.label}
            </button>
          ))}
        </div>
      </form>
    </section>
  );
}
