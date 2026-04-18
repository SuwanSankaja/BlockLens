"use client";

import { useRef, useState } from "react";
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
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  return (
    <section className="space-y-2.5">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-rose-300/60">
          Search
        </p>
        <h2 className="mt-1 text-base font-semibold tracking-tight text-slate-50">
          Find a transaction or address
        </h2>
      </div>

      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(query);
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-400">
            Bitcoin txid or address
          </span>
          <div className={`glow-border rounded-xl ${isFocused ? "glow-border-active" : ""}`}>
            <textarea
              ref={inputRef}
              rows={2}
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Paste a txid or address…"
              className="search-input surface w-full rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none transition-all duration-200"
              style={{ resize: "none" }}
            />
          </div>
        </label>

        {/* Detection badge */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium transition-colors duration-200 ${
              detection.kind === "transaction"
                ? "bg-sky-500/12 text-sky-200 ring-1 ring-sky-400/15"
                : detection.kind === "address"
                  ? "bg-cyan-500/12 text-cyan-200 ring-1 ring-cyan-400/15"
                  : "bg-amber-500/10 text-amber-200 ring-1 ring-amber-400/15"
            }`}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                detection.kind === "transaction"
                  ? "bg-sky-400"
                  : detection.kind === "address"
                    ? "bg-cyan-400"
                    : "bg-amber-400"
              }`}
            />
            {detection.kind === "unknown"
              ? "Awaiting valid input"
              : `Likely ${detection.kind}`}
          </span>
          <span className="text-slate-500">
            {detection.reason ??
              "Basic format validation only."}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="btn-glow rounded-full px-5 py-2 text-sm font-semibold shadow-lg"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                  <path d="M12 2a10 10 0 019.5 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Searching…
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                Search
              </span>
            )}
          </button>
          {EXAMPLES.map((example) => (
            <button
              key={example.label}
              type="button"
              onClick={() => onSubmit(example.value)}
              className="rounded-full border border-slate-700/60 bg-slate-900/50 px-3 py-2 text-xs font-medium text-slate-300 backdrop-blur-sm transition hover:border-sky-400/30 hover:bg-slate-800/60 hover:text-sky-200"
            >
              <span className="mr-1 opacity-60">₿</span>
              {example.label}
            </button>
          ))}
        </div>
      </form>
    </section>
  );
}
