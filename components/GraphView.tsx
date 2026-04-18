"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { DataSet, Network } from "vis-network/standalone";

import { buildCompactLayout } from "@/lib/graph/compactLayout";
import { buildFocusLayout } from "@/lib/graph/focusLayout";
import { buildOrbitLayout } from "@/lib/graph/orbitLayout";
import type { GraphData, GraphNode, GraphNodeType } from "@/types/graph";

interface GraphViewProps {
  graph: GraphData | null;
  selectedNode: GraphNode | null;
  selectedNodeId: string | null;
  expandingNodeId: string | null;
  maxDepth: number;
  onSelectNode: (nodeId: string | null) => void;
  onExpandNode: (nodeId: string, nodeType: GraphNodeType) => void;
}

const PAN_DISTANCE = 140;
const MIN_SCALE = 0.18;
const MAX_SCALE = 2.4;
const STABILIZE_ITERATIONS = 180;
const SEMANTIC_LAYOUT_THRESHOLD = 8;

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-12 w-12 items-center justify-center rounded-full border border-sky-400/18 bg-slate-950/78 text-sky-100 shadow-[0_10px_24px_rgba(0,0,0,0.34)] backdrop-blur transition hover:border-sky-300/45 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400/25"
    >
      {children}
    </button>
  );
}

function buildNodeStyle(
  node: GraphNode,
  options?: {
    depthFromFocus?: number;
    isFocusedLayout?: boolean;
    isFocusNode?: boolean;
    isSelected?: boolean;
    isDenseFreeform?: boolean;
    suppressPeripheralLabels?: boolean;
    fixedPosition?: boolean;
    x?: number;
    y?: number;
  },
) {
  const depthFromFocus = options?.depthFromFocus ?? 0;
  const isFocusedLayout = options?.isFocusedLayout ?? false;
  const isFocusNode = options?.isFocusNode ?? false;
  const isSelected = options?.isSelected ?? false;
  const isDenseFreeform = options?.isDenseFreeform ?? false;
  const suppressPeripheralLabels = options?.suppressPeripheralLabels ?? false;
  const shouldShowLabel = isFocusedLayout
    ? isFocusNode || isSelected || (!suppressPeripheralLabels && depthFromFocus <= 1)
    : isDenseFreeform
      ? isFocusNode || isSelected
      : true;
  const baseLabel = shouldShowLabel ? node.label : "";
  const compactFontSize = isDenseFreeform && !isFocusNode && !isSelected ? 11 : 13;

  if (node.type === "transaction") {
    return {
      id: node.id,
      label: baseLabel,
      title: node.label,
      shape: "box",
      borderWidth: 1.5,
      margin: 12,
      color: {
        background: isFocusNode ? "#14365e" : "#0d1b32",
        border: isSelected || isFocusNode ? "#8fd0ff" : "#5eb6ff",
        highlight: {
          background: "#13274a",
          border: "#8fd0ff",
        },
      },
      font: {
        color: "#eff6ff",
        face: "IBM Plex Sans",
        size:
          shouldShowLabel
            ? isDenseFreeform && !isFocusNode && !isSelected
              ? 12
              : 14
            : 1,
      },
      shadow: {
        enabled: true,
        color: isFocusNode
          ? "rgba(94, 182, 255, 0.3)"
          : "rgba(94, 182, 255, 0.16)",
        x: 0,
        y: 0,
        size: isFocusNode ? 26 : 18,
      },
      x: options?.x,
      y: options?.y,
      fixed: options?.fixedPosition || isFocusedLayout ? { x: true, y: true } : false,
      physics: !isFocusedLayout,
    };
  }

  return {
    id: node.id,
    label: baseLabel,
    title: node.label,
    shape: "dot",
    size: isFocusNode ? 22 : isDenseFreeform ? 16 : depthFromFocus >= 2 ? 15 : 18,
    color: {
      background: node.metadata.synthetic
        ? "#34210d"
        : isFocusNode
          ? "#123c61"
          : "#0d2740",
      border: node.metadata.synthetic
        ? "#f59e0b"
        : isSelected || isFocusNode
          ? "#8fd0ff"
          : "#38bdf8",
      highlight: {
        background: node.metadata.synthetic ? "#4a2b0a" : "#123a58",
        border: node.metadata.synthetic ? "#fbbf24" : "#7dd3fc",
      },
    },
    borderWidth: 2,
    font: {
      color: "#e0f2fe",
      face: "IBM Plex Sans",
      size: shouldShowLabel ? compactFontSize : 1,
    },
    shadow: {
      enabled: true,
      color: "rgba(56, 189, 248, 0.12)",
      x: 0,
      y: 0,
      size: isFocusNode ? 22 : 16,
    },
    x: options?.x,
    y: options?.y,
    fixed: options?.fixedPosition || isFocusedLayout ? { x: true, y: true } : false,
    physics: !isFocusedLayout,
  };
}

function buildEdgeStyle(
  edge: GraphData["edges"][number],
  options?: {
    isFocusedLayout?: boolean;
    focusNodeId?: string | null;
    selectedNodeId?: string | null;
    isDenseFreeform?: boolean;
    suppressFreeformLabels?: boolean;
    relativeDepthById?: Record<string, number>;
    placements?: Record<
      string,
      {
        side: "left" | "center" | "right";
      }
    >;
  },
) {
  const isFocusedLayout = options?.isFocusedLayout ?? false;
  const focusNodeId = options?.focusNodeId ?? null;
  const selectedNodeId = options?.selectedNodeId ?? null;
  const isDenseFreeform = options?.isDenseFreeform ?? false;
  const suppressFreeformLabels = options?.suppressFreeformLabels ?? false;
  const relativeDepthById = options?.relativeDepthById ?? {};
  const placements = options?.placements;
  const touchesFocus = focusNodeId
    ? edge.from === focusNodeId || edge.to === focusNodeId
    : false;
  const touchesSelected = selectedNodeId
    ? edge.from === selectedNodeId || edge.to === selectedNodeId
    : false;
  const deepestEdgeNodeDepth = Math.max(
    relativeDepthById[edge.from] ?? 0,
    relativeDepthById[edge.to] ?? 0,
  );
  const shouldShowLabel = isFocusedLayout
    ? touchesFocus || touchesSelected
    : !suppressFreeformLabels;
  const fromSide = placements?.[edge.from]?.side;
  const toSide = placements?.[edge.to]?.side;
  const sameLane =
    fromSide &&
    toSide &&
    fromSide !== "center" &&
    toSide !== "center" &&
    fromSide === toSide;
  const edgeWidth =
    isFocusedLayout && !touchesFocus && !touchesSelected && deepestEdgeNodeDepth >= 2
      ? 1.5
      : isDenseFreeform
        ? 1.8
      : touchesFocus || touchesSelected
        ? 2.9
        : 2.3;
  const commonProps = {
    width: edgeWidth,
    arrowStrikethrough: false,
    arrows: {
      to: {
        enabled: true,
        scaleFactor:
          isDenseFreeform
            ? 0.5
            : isFocusedLayout && !touchesFocus && !touchesSelected
              ? 0.85
              : 1.05,
      },
    },
    smooth: isFocusedLayout
      ? {
          enabled: true,
          type: "cubicBezier" as const,
          forceDirection: "horizontal" as const,
          roundness: sameLane ? 0.28 : 0.08,
        }
      : undefined,
  };

  if (edge.type === "spent_by") {
    return {
      id: edge.id,
      from: edge.from,
      to: edge.to,
      label: shouldShowLabel ? "spent by" : "",
      dashes: [8, 6],
      color: {
        color: "#60a5fa",
        highlight: "#93c5fd",
      },
      font: {
        size: 10,
        align: "top",
        color: "#bfdbfe",
      },
      ...commonProps,
    };
  }

  if (edge.type === "input") {
    return {
      id: edge.id,
      from: edge.from,
      to: edge.to,
      label: shouldShowLabel ? "input" : "",
      color: {
        color: "#fb923c",
        highlight: "#fdba74",
      },
      dashes: edge.metadata.heuristic ? [5, 4] : false,
      font: {
        size: 10,
        align: "middle",
        color: "#fed7aa",
      },
      ...commonProps,
    };
  }

  if (edge.type === "received_by") {
    return {
      id: edge.id,
      from: edge.from,
      to: edge.to,
      label: shouldShowLabel ? "received" : "",
      color: {
        color: "#22d3ee",
        highlight: "#67e8f9",
      },
      font: {
        size: 10,
        align: "middle",
        color: "#cffafe",
      },
      ...commonProps,
    };
  }

  return {
    id: edge.id,
    from: edge.from,
    to: edge.to,
    label: shouldShowLabel
      ? edge.metadata.spent
        ? "spent output"
        : "unspent output"
      : "",
    color: {
      color: edge.metadata.spent ? "#f59e0b" : "#38bdf8",
      highlight: edge.metadata.spent ? "#fbbf24" : "#7dd3fc",
    },
    dashes: edge.metadata.spent ? [6, 4] : false,
    font: {
      size: 10,
      align: "middle",
      color: edge.metadata.spent ? "#fde68a" : "#cffafe",
    },
    ...commonProps,
  };
}

export default function GraphView({
  graph,
  selectedNode,
  selectedNodeId,
  expandingNodeId,
  maxDepth,
  onSelectNode,
  onExpandNode,
}: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const networkRef = useRef<Network | null>(null);
  const nodesRef = useRef<DataSet<Record<string, unknown>> | null>(null);
  const edgesRef = useRef<DataSet<Record<string, unknown>> | null>(null);
  const lastNodeCountRef = useRef(0);
  const rootNodeIdRef = useRef<string | null>(null);
  const semanticLayoutEnabledRef = useRef(false);

  const selectedDepth = useMemo(() => {
    if (!graph || !selectedNodeId) {
      return null;
    }

    return graph.traversal.nodeDepthById[selectedNodeId] ?? null;
  }, [graph, selectedNodeId]);
  const focusNodeId = selectedNodeId ?? graph?.traversal.rootNodeId ?? null;
  const focusNodeDegree = useMemo(() => {
    if (!graph || !focusNodeId) {
      return 0;
    }

    return graph.edges.filter(
      (edge) => edge.from === focusNodeId || edge.to === focusNodeId,
    ).length;
  }, [focusNodeId, graph]);
  const graphTraversalDepth = useMemo(() => {
    if (!graph) {
      return 0;
    }

    return Math.max(...Object.values(graph.traversal.nodeDepthById), 0);
  }, [graph]);
  const shouldUseSemanticLayout = useMemo(() => {
    if (!graph || maxDepth <= 1) {
      return false;
    }

    return (
      graphTraversalDepth > 1 ||
      graph.nodes.length >= SEMANTIC_LAYOUT_THRESHOLD ||
      focusNodeDegree >= 6
    );
  }, [focusNodeDegree, graph, graphTraversalDepth, maxDepth]);
  const compactLayout = useMemo(() => {
    if (!graph || shouldUseSemanticLayout || graph.nodes.length > 8) {
      return null;
    }

    return buildCompactLayout(graph, graph.traversal.rootNodeId);
  }, [graph, shouldUseSemanticLayout]);
  const isDenseSingleHopFreeform = useMemo(() => {
    if (!graph || shouldUseSemanticLayout || compactLayout || maxDepth > 1) {
      return false;
    }

    return graph.nodes.length >= 20 || focusNodeDegree >= 8;
  }, [compactLayout, focusNodeDegree, graph, maxDepth, shouldUseSemanticLayout]);
  const suppressPeripheralLabels = useMemo(() => {
    if (!graph || !shouldUseSemanticLayout) {
      return false;
    }

    return graph.nodes.length >= 12 || focusNodeDegree >= 8;
  }, [focusNodeDegree, graph, shouldUseSemanticLayout]);
  const focusLayout = useMemo(() => {
    if (!graph || !focusNodeId || !shouldUseSemanticLayout) {
      return null;
    }

    return buildFocusLayout(graph, focusNodeId);
  }, [focusNodeId, graph, shouldUseSemanticLayout]);
  const orbitLayout = useMemo(() => {
    if (!graph || !focusNodeId || !isDenseSingleHopFreeform) {
      return null;
    }

    return buildOrbitLayout(graph, focusNodeId);
  }, [focusNodeId, graph, isDenseSingleHopFreeform]);

  const panView = useCallback((dx: number, dy: number) => {
    const network = networkRef.current;

    if (!network) {
      return;
    }

    const position = network.getViewPosition();
    network.moveTo({
      position: {
        x: position.x + dx,
        y: position.y + dy,
      },
      scale: network.getScale(),
      animation: {
        duration: 180,
        easingFunction: "easeInOutQuad",
      },
    });
  }, []);

  const zoomView = useCallback((multiplier: number) => {
    const network = networkRef.current;

    if (!network) {
      return;
    }

    const currentScale = network.getScale();
    const nextScale = Math.max(
      MIN_SCALE,
      Math.min(MAX_SCALE, currentScale * multiplier),
    );

    network.moveTo({
      scale: nextScale,
      animation: {
        duration: 180,
        easingFunction: "easeInOutQuad",
      },
    });
  }, []);

  const fitView = useCallback(() => {
    networkRef.current?.fit({
      animation: {
        duration: 240,
        easingFunction: "easeInOutQuad",
      },
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current || networkRef.current) {
      return;
    }

    nodesRef.current = new DataSet();
    edgesRef.current = new DataSet();
    networkRef.current = new Network(
      containerRef.current,
      {
        nodes: nodesRef.current,
        edges: edgesRef.current,
      },
      {
        autoResize: true,
        interaction: {
          hover: true,
          multiselect: false,
          tooltipDelay: 120,
          hoverConnectedEdges: true,
          hideEdgesOnDrag: false,
          hideEdgesOnZoom: false,
          selectable: true,
          dragView: true,
          zoomView: true,
          selectConnectedEdges: false,
        },
        physics: {
          enabled: true,
          stabilization: {
            enabled: true,
            iterations: STABILIZE_ITERATIONS,
            updateInterval: 20,
            fit: false,
          },
          barnesHut: {
            gravitationalConstant: -9000,
            springLength: 150,
            springConstant: 0.03,
          },
        },
        nodes: {
          shadow: {
            enabled: true,
            color: "rgba(8, 14, 28, 0.45)",
            x: 0,
            y: 12,
            size: 24,
          },
        },
        edges: {
          smooth: {
            enabled: true,
            type: "dynamic",
            roundness: 0.25,
          },
          selectionWidth: 3,
        },
      },
    );

    networkRef.current.on("selectNode", (params) => {
      const nodeId = typeof params.nodes[0] === "string" ? params.nodes[0] : null;
      onSelectNode(nodeId);
    });

    networkRef.current.on("deselectNode", () => {
      onSelectNode(null);
    });

    networkRef.current.on("click", (params) => {
      if (params.nodes.length === 0 && params.edges.length === 0) {
        onSelectNode(null);
      }
    });

    return () => {
      networkRef.current?.destroy();
      networkRef.current = null;
    };
  }, [onSelectNode]);

  useEffect(() => {
    if (!graph || !nodesRef.current || !edgesRef.current || !networkRef.current) {
      return;
    }

    const network = networkRef.current;
    const shouldUseFixedCompactLayout = Boolean(compactLayout);
    const shouldRunPhysics =
      !shouldUseSemanticLayout && !shouldUseFixedCompactLayout && graph.nodes.length > 2;
    const stabilizationIterations = isDenseSingleHopFreeform
      ? STABILIZE_ITERATIONS + 80
      : STABILIZE_ITERATIONS;

    network.setOptions({
      interaction: {
        dragNodes: !shouldUseSemanticLayout && !shouldUseFixedCompactLayout,
        dragView: true,
        zoomView: true,
        hover: true,
        multiselect: false,
        tooltipDelay: shouldUseSemanticLayout ? 180 : 120,
        hoverConnectedEdges: !shouldUseSemanticLayout,
        hideEdgesOnDrag: shouldUseSemanticLayout,
        hideEdgesOnZoom: shouldUseSemanticLayout,
        selectable: true,
        selectConnectedEdges: false,
      },
      physics: {
        enabled: shouldRunPhysics,
        stabilization: {
          enabled: shouldRunPhysics,
          iterations: stabilizationIterations,
          updateInterval: 20,
          fit: false,
        },
        barnesHut: {
          gravitationalConstant: isDenseSingleHopFreeform ? -15000 : -9000,
          springLength: isDenseSingleHopFreeform ? 250 : 150,
          springConstant: isDenseSingleHopFreeform ? 0.02 : 0.03,
          damping: isDenseSingleHopFreeform ? 0.18 : 0.11,
          avoidOverlap: isDenseSingleHopFreeform ? 0.5 : 0.12,
        },
      },
      edges: {
        smooth: shouldUseSemanticLayout
          ? {
              enabled: true,
              type: "cubicBezier",
              roundness: 0.18,
            }
          : {
              enabled: true,
              type: "dynamic",
              roundness: 0.25,
            },
        selectionWidth: 3,
      },
    });

    nodesRef.current.clear();
    edgesRef.current.clear();
    nodesRef.current.add(
      graph.nodes.map((node) =>
        buildNodeStyle(node, {
          depthFromFocus: focusLayout?.relativeDepthById[node.id] ?? 0,
          isFocusedLayout: shouldUseSemanticLayout,
          isFocusNode: focusLayout?.focusNodeId === node.id,
          isSelected: selectedNodeId === node.id,
          isDenseFreeform: isDenseSingleHopFreeform,
          suppressPeripheralLabels,
          fixedPosition:
            shouldUseFixedCompactLayout ||
            (!shouldUseSemanticLayout && orbitLayout?.focusNodeId === node.id),
          x:
            compactLayout?.placements[node.id]?.x ??
            focusLayout?.placements[node.id]?.x ??
            orbitLayout?.placements[node.id]?.x,
          y:
            compactLayout?.placements[node.id]?.y ??
            focusLayout?.placements[node.id]?.y ??
            orbitLayout?.placements[node.id]?.y,
        }),
      ),
    );
    edgesRef.current.add(
      graph.edges.map((edge) =>
        buildEdgeStyle(edge, {
          isFocusedLayout: shouldUseSemanticLayout,
          focusNodeId: focusLayout?.focusNodeId ?? focusNodeId,
          selectedNodeId,
          isDenseFreeform: isDenseSingleHopFreeform,
          suppressFreeformLabels: isDenseSingleHopFreeform,
          relativeDepthById: focusLayout?.relativeDepthById,
          placements: focusLayout?.placements,
        }),
      ),
    );

    if (shouldRunPhysics) {
      network.once("stabilized", () => {
        network.setOptions({
          physics: {
            enabled: false,
          },
        });
        network.stopSimulation();
      });
      network.stabilize(stabilizationIterations);
    } else {
      network.setOptions({
        physics: {
          enabled: false,
        },
      });
    }

    const graphShapeChanged =
      graph.nodes.length !== lastNodeCountRef.current ||
      rootNodeIdRef.current !== graph.traversal.rootNodeId ||
      semanticLayoutEnabledRef.current !== shouldUseSemanticLayout;

    if (shouldUseFixedCompactLayout) {
      if (graphShapeChanged) {
        network.fit({
          animation: {
            duration: 220,
            easingFunction: "easeInOutQuad",
          },
        });
      }
    } else if (shouldUseSemanticLayout) {
      if (graphShapeChanged) {
        network.fit({
          animation: {
            duration: 220,
            easingFunction: "easeInOutQuad",
          },
        });
      } else {
        network.moveTo({
          position: {
            x: 0,
            y: 0,
          },
          scale: network.getScale(),
          animation: {
            duration: 180,
            easingFunction: "easeInOutQuad",
          },
        });
      }
    } else if (
      graph.nodes.length > lastNodeCountRef.current ||
      rootNodeIdRef.current !== graph.traversal.rootNodeId
    ) {
      network.fit({
        animation: {
          duration: 400,
          easingFunction: "easeInOutQuad",
        },
      });
    }

    lastNodeCountRef.current = graph.nodes.length;
    rootNodeIdRef.current = graph.traversal.rootNodeId;
    semanticLayoutEnabledRef.current = shouldUseSemanticLayout;
  }, [
    focusLayout,
    compactLayout,
    orbitLayout,
    focusNodeId,
    graph,
    selectedNodeId,
    shouldUseSemanticLayout,
    isDenseSingleHopFreeform,
    suppressPeripheralLabels,
  ]);

  useEffect(() => {
    const network = networkRef.current;

    if (!network) {
      return;
    }

    if (!selectedNodeId) {
      network.unselectAll();
      return;
    }

    if (!graph?.nodes.some((node) => node.id === selectedNodeId)) {
      network.unselectAll();
      return;
    }

    network.selectNodes([selectedNodeId]);

    if (shouldUseSemanticLayout || compactLayout || isDenseSingleHopFreeform) {
      return;
    }

    const position = network.getPosition(selectedNodeId);

    network.moveTo({
      position,
      scale: network.getScale(),
      animation: {
        duration: 220,
        easingFunction: "easeInOutQuad",
      },
    });
  }, [
    graph,
    selectedNodeId,
    shouldUseSemanticLayout,
    compactLayout,
    isDenseSingleHopFreeform,
  ]);

  const expansionDisabled =
    !graph ||
    !selectedNode ||
    graph.traversal.expandedNodeIds.includes(selectedNode.id) ||
    (selectedDepth !== null && selectedDepth >= maxDepth) ||
    expandingNodeId === selectedNode?.id;

  return (
    <section className="panel relative min-h-[520px] overflow-hidden rounded-[2rem] p-3 lg:min-h-[680px]">
      <div className="absolute -left-10 top-0 h-32 w-32 rounded-full bg-sky-500/12 blur-3xl" />
      <div className="absolute -right-10 bottom-0 h-36 w-36 rounded-full bg-blue-500/12 blur-3xl" />
      {!graph ? (
        <div className="surface flex h-full min-h-[500px] items-center justify-center rounded-[1.6rem] border border-dashed border-sky-400/18 p-8 text-center">
          <div className="max-w-md space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
              Empty graph
            </p>
            <h3 className="text-2xl font-semibold text-slate-50">
              Search the chain to start exploring
            </h3>
            <p className="text-sm leading-6 text-slate-400">
              BlockLens Explorer shows on-chain relationships only. It does not attempt
              ownership or entity attribution.
            </p>
          </div>
        </div>
      ) : graph.nodes.length === 0 ? (
        <div className="surface flex h-full min-h-[500px] items-center justify-center rounded-[1.6rem] border border-dashed border-sky-400/18 p-8 text-center">
          <div className="max-w-md space-y-3">
            <h3 className="text-xl font-semibold text-slate-50">No nodes match the current filters</h3>
            <p className="text-sm leading-6 text-slate-400">
              Lower the minimum value filter or show already visited nodes to reveal more of
              the graph.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <div ref={containerRef} className="h-[520px] rounded-[1.6rem] lg:h-[680px]" />
            <div className="pointer-events-none absolute inset-x-6 top-6 flex flex-wrap gap-2">
              <span className="pointer-events-auto rounded-full border border-sky-400/16 bg-slate-950/70 px-3 py-1 text-xs font-medium text-slate-200 shadow-sm backdrop-blur">
                {graph.nodes.length} nodes
              </span>
              <span className="pointer-events-auto rounded-full border border-sky-400/16 bg-slate-950/70 px-3 py-1 text-xs font-medium text-slate-200 shadow-sm backdrop-blur">
                {graph.edges.length} edges
              </span>
              {graph.truncated ? (
                <span className="pointer-events-auto rounded-full border border-amber-300/20 bg-amber-400/14 px-3 py-1 text-xs font-medium text-amber-100 shadow-sm backdrop-blur">
                  Truncated at {graph.maxNodes} nodes
                </span>
              ) : null}
            </div>

            {focusLayout ? (
              <div className="pointer-events-none absolute inset-x-6 top-20 hidden justify-between gap-4 lg:flex">
                {focusLayout.laneBadges.map((badge) => (
                  <div
                    key={badge.id}
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] backdrop-blur ${
                      badge.side === "left"
                        ? "border-amber-300/20 bg-amber-400/10 text-amber-100"
                        : "border-sky-300/20 bg-sky-500/10 text-sky-100"
                    }`}
                  >
                    {badge.label}
                  </div>
                ))}
              </div>
            ) : null}

            <div className="pointer-events-none absolute bottom-6 left-6 right-6 flex items-end justify-between">
              <div className="pointer-events-auto flex items-center gap-2">
                <div className="grid grid-cols-3 gap-2">
                  <div />
                  <ControlButton label="Pan up" onClick={() => panView(0, -PAN_DISTANCE)}>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 18V7M12 7L7 12M12 7L17 12"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </ControlButton>
                  <div />
                  <ControlButton label="Pan left" onClick={() => panView(-PAN_DISTANCE, 0)}>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M18 12H7M7 12L12 7M7 12L12 17"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </ControlButton>
                  <ControlButton label="Pan down" onClick={() => panView(0, PAN_DISTANCE)}>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 6V17M12 17L17 12M12 17L7 12"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </ControlButton>
                  <ControlButton label="Pan right" onClick={() => panView(PAN_DISTANCE, 0)}>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M6 12H17M17 12L12 7M17 12L12 17"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </ControlButton>
                </div>
              </div>

              <div className="pointer-events-auto flex items-center gap-2">
                <ControlButton label="Fit graph" onClick={fitView}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M9 4H4V9M15 4H20V9M4 15V20H9M20 15V20H15"
                      stroke="currentColor"
                      strokeWidth="2.1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </ControlButton>
                <ControlButton label="Zoom out" onClick={() => zoomView(0.82)}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M8 10.5H13M15.5 15.5L20 20M16 10.5C16 13.5376 13.5376 16 10.5 16C7.46243 16 5 13.5376 5 10.5C5 7.46243 7.46243 5 10.5 5C13.5376 5 16 7.46243 16 10.5Z"
                      stroke="currentColor"
                      strokeWidth="2.1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </ControlButton>
                <ControlButton label="Zoom in" onClick={() => zoomView(1.22)}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M10.5 8V13M8 10.5H13M15.5 15.5L20 20M16 10.5C16 13.5376 13.5376 16 10.5 16C7.46243 16 5 13.5376 5 10.5C5 7.46243 7.46243 5 10.5 5C13.5376 5 16 7.46243 16 10.5Z"
                      stroke="currentColor"
                      strokeWidth="2.1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </ControlButton>
              </div>
            </div>
          </div>

          {selectedNode ? (
            <div className="rounded-3xl border border-sky-400/14 bg-slate-950/78 p-4 shadow-lg backdrop-blur-xl">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Selected node
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-50">
                    {selectedNode.label}
                  </h3>
                  <p className="mt-1 text-sm text-slate-400">
                    {selectedNode.type} node at depth {selectedDepth ?? 0}
                  </p>
                  {focusLayout ? (
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-sky-200/60">
                      Focused neighborhood layout
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={expansionDisabled}
                  onClick={() => onExpandNode(selectedNode.id, selectedNode.type)}
                  className="rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)] transition hover:from-sky-400 hover:to-blue-500 disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400 disabled:shadow-none"
                >
                  {expandingNodeId === selectedNode.id ? "Expanding..." : "Expand 1 hop"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
