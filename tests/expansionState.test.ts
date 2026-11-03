import { describe, expect, it } from "vitest";
import { getExpansionState } from "@/lib/graph/expansionState";
import { graph, node } from "./helpers";

const A = "address:1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa";
const mk = () => {
  const g = graph([node(A), node("tx:" + "b".repeat(64))], []);
  g.traversal.nodeDepthById = { [A]: 0 };
  return g;
};

describe("getExpansionState", () => {
  it("no graph / no node: disabled with reason", () => {
    for (const s of [getExpansionState(null, A, 2, null), getExpansionState(mk(), null, 2, null)]) {
      expect(s.canExpand).toBe(false);
      expect(s.reason).toBeTruthy();
    }
  });
  it("enabled when possible", () => {
    expect(getExpansionState(mk(), A, 2, null)).toEqual({ canExpand: true, reason: null, isExpanding: false });
  });
  it("loading state for the expanding node", () => {
    const s = getExpansionState(mk(), A, 2, A);
    expect(s).toMatchObject({ canExpand: false, isExpanding: true });
    expect(s.reason).toBeTruthy();
  });
  it("other node expanding blocks with reason", () => {
    const s = getExpansionState(mk(), A, 2, "tx:x");
    expect(s.canExpand).toBe(false);
    expect(s.isExpanding).toBe(false);
    expect(s.reason).toBeTruthy();
  });
  it("already expanded", () => {
    const g = mk();
    g.traversal.expandedNodeIds = [A];
    const s = getExpansionState(g, A, 2, null);
    expect(s.canExpand).toBe(false);
    expect(s.reason).toMatch(/expanded/i);
  });
  it("synthetic script node", () => {
    const g = graph([node("address:script:x:output:0", { metadata: { synthetic: true } })], []);
    const s = getExpansionState(g, "address:script:x:output:0", 2, null);
    expect(s.canExpand).toBe(false);
    expect(s.reason).toBeTruthy();
  });
  it("max depth reached", () => {
    const g = mk();
    g.traversal.nodeDepthById[A] = 2;
    const s = getExpansionState(g, A, 2, null);
    expect(s.canExpand).toBe(false);
    expect(s.reason).toMatch(/depth/i);
    expect(getExpansionState(g, A, 3, null).canExpand).toBe(true);
  });
  it("node limit reached", () => {
    const g = mk();
    g.maxNodes = 2;
    const s = getExpansionState(g, A, 2, null);
    expect(s.canExpand).toBe(false);
    expect(s.reason).toMatch(/limit/i);
  });
});
