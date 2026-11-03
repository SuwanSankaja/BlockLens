import { describe, expect, it } from "vitest";
import { applyGraphFilters, buildSummaryCards } from "@/lib/graph/viewGraph";
import type { SearchSummary } from "@/types/graph";
import { GENESIS, OPTS, edge, graph, node } from "./helpers";

const T = "tx:" + "b".repeat(64);
const A = "address:" + GENESIS;

function noDangling(g: ReturnType<typeof graph>) {
  const ids = new Set(g.nodes.map((n) => n.id));
  return g.edges.every((e) => ids.has(e.from) && ids.has(e.to));
}

describe("applyGraphFilters", () => {
  it("empty graph", () => {
    const g = graph([], []);
    const r = applyGraphFilters(g, OPTS, null);
    expect(r.nodes).toEqual([]);
    expect(r.edges).toEqual([]);
  });
  it("aggregates parallel edges; badge count equals edges drawn", () => {
    const g = graph(
      [node(T), node(A)],
      [edge("1", T, A, { value: 10 }), edge("2", T, A, { value: 20 }), edge("3", A, T)],
    );
    const r = applyGraphFilters(g, OPTS, null);
    expect(r.edges).toHaveLength(2);
    expect(r.edges.find((e) => e.id.startsWith("agg:"))?.value).toBe(30);
    expect(noDangling(r)).toBe(true);
  });
  it("all edges dangling are removed (edges to missing nodes)", () => {
    const g = graph([node(T)], [edge("1", T, "address:ghost"), edge("2", "address:g2", T)]);
    const r = applyGraphFilters(g, OPTS, null);
    expect(r.edges).toEqual([]);
  });
  it("hideVisited hides expanded node and drops its edges", () => {
    const g = graph([node(T), node(A), node("address:x")], [edge("1", T, A), edge("2", A, "address:x")]);
    g.traversal.expandedNodeIds = [A];
    const r = applyGraphFilters(g, { ...OPTS, hideVisited: true }, null);
    expect(r.nodes.map((n) => n.id)).not.toContain(A);
    expect(noDangling(r)).toBe(true);
    expect(r.edges).toEqual([]);
  });
  it("min value and tiny output filters apply", () => {
    const g = graph(
      [node(T), node(A), node("address:x")],
      [edge("1", T, A, { value: 100 }), edge("2", T, "address:x", { value: 5000 })],
    );
    expect(applyGraphFilters(g, { ...OPTS, minValueSats: 1000 }, null).edges).toHaveLength(1);
    expect(applyGraphFilters(g, { ...OPTS, hideTinyOutputs: true }, null).edges).toHaveLength(1);
  });
  it("confirmedOnly drops edges to unconfirmed non-root txs", () => {
    const U = "tx:" + "c".repeat(64);
    const g = graph(
      [node(A), node(U, { metadata: { confirmed: false } })],
      [edge("1", A, U)],
    );
    const r = applyGraphFilters(g, { ...OPTS, confirmedOnly: true }, null);
    expect(r.edges).toEqual([]);
    expect(noDangling(r)).toBe(true);
  });
  it("does not mutate input", () => {
    const g = graph([node(T), node(A)], [edge("1", T, A), edge("2", T, A)]);
    const copy = JSON.parse(JSON.stringify(g));
    applyGraphFilters(g, OPTS, null);
    expect(g).toEqual(copy);
  });
  it("selected node kept visible", () => {
    const g = graph([node(T), node(A)], []);
    expect(applyGraphFilters(g, OPTS, A).nodes.map((n) => n.id)).toContain(A);
  });
});

describe("buildSummaryCards", () => {
  it("idle state", () => {
    const c = buildSummaryCards(null, null, 3);
    expect(c.find((x) => x.label === "Depth")?.value).toBe("0 / 3");
  });
  const addrSummary = (chain: object | undefined, mem: object | undefined): SearchSummary =>
    ({
      kind: "address",
      provider: "mempool",
      query: GENESIS,
      warnings: [],
      graph: graph([node(A)], []),
      addressBundle: {
        address: { address: GENESIS, chain_stats: chain, mempool_stats: mem },
        transactions: [],
      },
    }) as unknown as SearchSummary;
  it("genesis: Spent is 0 BTC / never spent, not Unknown", () => {
    const s = addrSummary(
      { funded_txo_count: 5, funded_txo_sum: 100, spent_txo_count: 0, spent_txo_sum: 0, tx_count: 5 },
      { funded_txo_count: 0, funded_txo_sum: 0, spent_txo_count: 0, spent_txo_sum: 0, tx_count: 0 },
    );
    const cards = buildSummaryCards(s, s.graph, 2);
    const spent = cards.find((c) => c.label === "Spent")!;
    expect(spent.value).not.toBe("Unknown");
    expect(spent.hint).toMatch(/never spent/i);
  });
  it("null stats show Unknown rather than 0", () => {
    const s = addrSummary(undefined, undefined);
    const cards = buildSummaryCards(s, s.graph, 2);
    expect(cards.find((c) => c.label === "Funded")?.value).toBe("Unknown");
    expect(cards.find((c) => c.label === "Spent")?.value).toBe("Unknown");
    expect(cards.find((c) => c.label === "Address")?.hint).toMatch(/unknown/);
  });
  it("visible edges card equals drawn edges", () => {
    const g = graph([node(T), node(A)], [edge("1", T, A), edge("2", T, A)]);
    const vis = applyGraphFilters(g, OPTS, null);
    const s = { kind: "unknown", provider: "mempool", query: "", warnings: [], graph: g } as unknown as SearchSummary;
    const cards = buildSummaryCards(s, vis, 2);
    expect(cards.find((c) => c.label === "Visible edges")?.value).toBe(String(vis.edges.length));
    expect(vis.edges).toHaveLength(1);
  });
});
