import { describe, expect, it } from "vitest";
import {
  aggregateParallelEdges,
  formatAggregatedEdgeLabel,
  pruneDanglingEdges,
} from "@/lib/graph/aggregateEdges";
import { edge, node } from "./helpers";

describe("pruneDanglingEdges", () => {
  it("handles empty inputs", () => {
    expect(pruneDanglingEdges([], [])).toEqual([]);
    expect(pruneDanglingEdges([node("a")], [])).toEqual([]);
  });
  it("drops all edges when all dangling", () => {
    expect(pruneDanglingEdges([], [edge("1", "a", "b")])).toEqual([]);
    expect(pruneDanglingEdges([node("a")], [edge("1", "a", "b"), edge("2", "x", "a")])).toEqual([]);
  });
  it("keeps edges with both endpoints", () => {
    const e = edge("1", "a", "b");
    expect(pruneDanglingEdges([node("a"), node("b")], [e, edge("2", "a", "z")])).toEqual([e]);
  });
});

describe("aggregateParallelEdges", () => {
  it("returns empty for empty", () => {
    expect(aggregateParallelEdges([])).toEqual([]);
  });
  it("single edge keeps id, count 1", () => {
    const [e] = aggregateParallelEdges([edge("e1", "a", "b", { value: 5 })]);
    expect(e.id).toBe("e1");
    expect(e.metadata.count).toBe(1);
    expect(e.value).toBe(5);
  });
  it("merges parallel edges with sum and metadata", () => {
    const out = aggregateParallelEdges([
      edge("e1", "a", "b", { value: 100 }),
      edge("e2", "a", "b", { value: 250 }),
      edge("e3", "a", "b"),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("agg:a|b|output");
    expect(out[0].value).toBe(350);
    expect(out[0].metadata).toMatchObject({
      count: 3,
      totalValueSats: 350,
      edgeIds: ["e1", "e2", "e3"],
    });
  });
  it("does not merge across direction or type", () => {
    const out = aggregateParallelEdges([
      edge("1", "a", "b"),
      edge("2", "b", "a"),
      edge("3", "a", "b", { type: "input" }),
    ]);
    expect(out).toHaveLength(3);
  });
  it("value undefined when no edge has a value", () => {
    const [e] = aggregateParallelEdges([edge("1", "a", "b"), edge("2", "a", "b")]);
    expect(e.value).toBeUndefined();
  });
  it("spent/heuristic true only if all merged have it (mixed flags)", () => {
    const [mixed] = aggregateParallelEdges([
      edge("1", "a", "b", { metadata: { spent: true, heuristic: true } }),
      edge("2", "a", "b", { metadata: { spent: false, heuristic: true } }),
    ]);
    expect(mixed.metadata.spent).toBe(false);
    expect(mixed.metadata.heuristic).toBe(true);
    const [all] = aggregateParallelEdges([
      edge("1", "a", "b", { metadata: { spent: true } }),
      edge("2", "a", "b", { metadata: { spent: true } }),
    ]);
    expect(all.metadata.spent).toBe(true);
    expect(all.metadata.heuristic).toBe(false);
  });
  it("is deterministic in first-occurrence order", () => {
    const out = aggregateParallelEdges([edge("1", "x", "y"), edge("2", "a", "b"), edge("3", "x", "y")]);
    expect(out.map((e) => e.from)).toEqual(["x", "a"]);
  });
});

describe("formatAggregatedEdgeLabel", () => {
  it("formats count and value", () => {
    const [e] = aggregateParallelEdges([
      edge("1", "a", "b", { value: 1_000_000 }),
      edge("2", "a", "b", { value: 1_000_000 }),
    ]);
    expect(formatAggregatedEdgeLabel(e)).toBe("2x | 0.0200 BTC");
  });
  it("count only when no value", () => {
    const [e] = aggregateParallelEdges([edge("1", "a", "b"), edge("2", "a", "b")]);
    expect(formatAggregatedEdgeLabel(e)).toBe("2x");
  });
  it("single edge shows value only; no value gives empty", () => {
    expect(formatAggregatedEdgeLabel(edge("1", "a", "b", { value: 50 }))).toBe("0.00000050 BTC");
    expect(formatAggregatedEdgeLabel(edge("1", "a", "b"))).toBe("");
  });
});
