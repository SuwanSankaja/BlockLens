import { describe, expect, it } from "vitest";
import { validateExpandRequest } from "@/lib/graph/validateExpand";
import { GENESIS, OPTS, TXID, edge, graph, node } from "./helpers";

const body = (over: Record<string, unknown> = {}) => ({
  targetNodeId: `address:${GENESIS}`,
  targetNodeType: "address",
  graph: graph([node(`address:${GENESIS}`)], []),
  options: OPTS,
  ...over,
});

describe("validateExpandRequest", () => {
  it("accepts valid address and tx bodies", () => {
    expect(validateExpandRequest(body()).ok).toBe(true);
    expect(
      validateExpandRequest(body({ targetNodeId: `tx:${TXID}`, targetNodeType: "transaction" })).ok,
    ).toBe(true);
  });
  it.each([null, undefined, "str", 5, [], {}])("rejects malformed body %j", (b) => {
    expect(validateExpandRequest(b).ok).toBe(false);
  });
  it("rejects bad target ids", () => {
    const bad = [
      "address:../../foo",
      "address:",
      "address:not-an-address",
      `address:${GENESIS}/../x`,
      `address:${GENESIS}?x=1`,
      "tx:" + "z".repeat(64),
      `tx:${TXID}`, // wrong type for address
      GENESIS, // missing prefix
      "",
      "address:" + "a".repeat(5000),
    ];
    for (const id of bad) {
      expect(validateExpandRequest(body({ targetNodeId: id })).ok, id).toBe(false);
    }
  });
  it("rejects tx ids with path injection or wrong length", () => {
    for (const id of ["tx:../../foo", `tx:${TXID.slice(1)}`, `tx:${TXID}a`, `tx:${TXID}/x`]) {
      expect(validateExpandRequest(body({ targetNodeId: id, targetNodeType: "transaction" })).ok, id).toBe(false);
    }
  });
  it("rejects invalid targetNodeType", () => {
    expect(validateExpandRequest(body({ targetNodeType: "block" })).ok).toBe(false);
    expect(validateExpandRequest(body({ targetNodeType: undefined })).ok).toBe(false);
  });
  it("rejects non-string targetNodeId", () => {
    expect(validateExpandRequest(body({ targetNodeId: 123 })).ok).toBe(false);
    expect(validateExpandRequest(body({ targetNodeId: { a: 1 } })).ok).toBe(false);
  });
  it("rejects malformed graph", () => {
    for (const g of [
      undefined,
      null,
      "x",
      {},
      { nodes: [], edges: [] },
      { nodes: {}, edges: [], traversal: { expandedNodeIds: [], nodeDepthById: {} } },
      { nodes: [], edges: [], traversal: { expandedNodeIds: "a", nodeDepthById: {} } },
      { nodes: [], edges: [], traversal: { expandedNodeIds: [], nodeDepthById: null } },
    ]) {
      expect(validateExpandRequest(body({ graph: g })).ok).toBe(false);
    }
  });
  it("rejects oversized graphs", () => {
    const nodes = Array.from({ length: 1001 }, (_, i) => node(`address:n${i}`));
    expect(validateExpandRequest(body({ graph: graph(nodes, []) })).ok).toBe(false);
    const edges = Array.from({ length: 20001 }, (_, i) => edge(`e${i}`, "a", "b"));
    expect(validateExpandRequest(body({ graph: graph([node("a")], edges) })).ok).toBe(false);
  });
  it("accepts graph exactly at limits", () => {
    const nodes = Array.from({ length: 1000 }, (_, i) => node(`address:n${i}`));
    expect(validateExpandRequest(body({ graph: graph(nodes, []) })).ok).toBe(true);
  });
  it("failure returns message", () => {
    const r = validateExpandRequest(null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message.length).toBeGreaterThan(0);
  });
});
