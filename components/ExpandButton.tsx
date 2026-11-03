"use client";

import { getExpansionState } from "@/lib/graph/expansionState";
import type { GraphData } from "@/types/graph";

interface ExpandButtonProps {
  graph: GraphData | null;
  nodeId: string;
  maxDepth: number;
  expandingNodeId: string | null;
  onExpand: () => void;
  className?: string;
}

export default function ExpandButton({
  graph,
  nodeId,
  maxDepth,
  expandingNodeId,
  onExpand,
  className = "",
}: ExpandButtonProps) {
  const state = getExpansionState(graph, nodeId, maxDepth, expandingNodeId);
  const reasonId = `expand-reason-${nodeId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        // aria-disabled keeps the button focusable so the reason can be read.
        aria-disabled={!state.canExpand}
        aria-busy={state.isExpanding}
        aria-describedby={state.reason ? reasonId : undefined}
        title={state.reason ?? "Fetch this node's direct neighbors"}
        onClick={() => {
          if (state.canExpand) {
            onExpand();
          }
        }}
        data-disabled={!state.canExpand}
        className={`btn-glow rounded-full px-4 py-1.5 text-xs font-semibold ${className}`}
      >
        {state.isExpanding ? (
          <span className="flex items-center gap-1.5">
            <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
              <path d="M12 2a10 10 0 019.5 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            Expanding...
          </span>
        ) : (
          "Expand 1 hop"
        )}
      </button>
      {state.reason && !state.isExpanding ? (
        <p id={reasonId} className="max-w-[16rem] text-right text-[11px] leading-4 text-slate-400">
          {state.reason}
        </p>
      ) : (
        <span id={reasonId} className="sr-only" role="status">
          {state.isExpanding ? "Expanding node" : ""}
        </span>
      )}
    </div>
  );
}
