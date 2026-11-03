import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateExpandRequest } from "@/lib/graph/validateExpand";
import { toApiErrorShape } from "@/lib/blockchain/provider";
import { GENESIS, OPTS, TXID, edge, graph, node } from "./helpers";

const A = `address:${GENESIS}`;
const body = (g: unknown) => ({ targetNodeId: A, targetNodeType: "address", graph: g, options: OPTS });
const base = () => graph([node(A)], []);

describe("validateExpandRequest caps and shapes", () => {
  it("rejects expandedNodeIds over 1000 (1000 ok)", () => {
    const g = base();
    g.traversal.expandedNodeIds = Array.from({ length: 1000 }, (_, i) => `n${i}`);
    expect(validateExpandRequest(body(g)).ok).toBe(true);
    g.traversal.expandedNodeIds.push("x");
    expect(validateExpandRequest(body(g)).ok).toBe(false);
  });
  it("rejects nodeDepthById over 1000 entries", () => {
    const g = base();
    g.traversal.nodeDepthById = Object.fromEntries(Array.from({ length: 1001 }, (_, i) => [`n${i}`, 1]));
    expect(validateExpandRequest(body(g)).ok).toBe(false);
  });
  it("rejects non-string expandedNodeIds entries", () => {
    const g = base();
    (g.traversal.expandedNodeIds as unknown[]).push(5, null);
    expect(validateExpandRequest(body(g)).ok).toBe(false);
  });
  it.each([["a"], [NaN], [Infinity], [null], [{}], [undefined]])("rejects bad depth %j", (d) => {
    const g = base();
    (g.traversal.nodeDepthById as Record<string, unknown>)[A] = d;
    expect(validateExpandRequest(body(g)).ok).toBe(false);
  });
  it("accepts valid depths including 0", () => {
    const g = base();
    g.traversal.nodeDepthById = { [A]: 0, other: 3 };
    expect(validateExpandRequest(body(g)).ok).toBe(true);
  });
  it.each([null, 5, "s", {}, { id: 1, type: "address" }, { id: "x", type: "block" }, { id: "x" }])(
    "rejects bad node %j",
    (n) => {
      const g = base();
      (g.nodes as unknown[]).push(n);
      expect(validateExpandRequest(body(g)).ok).toBe(false);
    },
  );
  it.each([null, 5, {}, { id: "e", from: "a" }, { id: 1, from: "a", to: "b" }, { id: "e", from: 1, to: "b" }, { id: "e", from: "a", to: {} }])(
    "rejects bad edge %j",
    (e) => {
      const g = base();
      (g.edges as unknown[]).push(e);
      expect(validateExpandRequest(body(g)).ok).toBe(false);
    },
  );
  it("accepts well-formed nodes and edges", () => {
    const g = graph([node(A), node(`tx:${TXID}`)], [edge("e", A, `tx:${TXID}`)]);
    expect(validateExpandRequest(body(g)).ok).toBe(true);
  });
});

describe("expand route body cap", () => {
  const fetchMock = vi.fn(async () => {
    throw new Error("network disabled");
  });
  beforeEach(() => vi.stubGlobal("fetch", fetchMock));
  afterEach(() => vi.unstubAllGlobals());

  it("rejects body over 2 MB with 400 and no upstream calls", async () => {
    const { POST } = await import("@/app/api/expand/route");
    const big = JSON.stringify({ pad: "x".repeat(2 * 1024 * 1024 + 10) });
    const res = await POST(
      new NextRequest("http://localhost/api/expand", { method: "POST", body: big }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_request");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects oversized declared content-length without reading", async () => {
    const { POST } = await import("@/app/api/expand/route");
    const res = await POST(
      new NextRequest("http://localhost/api/expand", {
        method: "POST",
        body: "{}",
        headers: { "content-length": String(3 * 1024 * 1024) },
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("error responses do not leak details", () => {
  it("toApiErrorShape omits details", () => {
    const shape = toApiErrorShape(new Error("upstream said: SECRET-BODY-123"));
    expect(shape).not.toHaveProperty("details");
    expect(JSON.stringify(shape)).not.toContain("SECRET-BODY-123");
  });
  it("search route upstream failure has no details", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("SECRET-UPSTREAM-BODY", { status: 500 })),
    );
    const { GET } = await import("@/app/api/search/route");
    const res = await GET(new NextRequest(`http://localhost/api/search?q=${GENESIS}`));
    const text = await res.text();
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(text).not.toContain("SECRET-UPSTREAM-BODY");
    expect(JSON.parse(text).error).not.toHaveProperty("details");
    vi.unstubAllGlobals();
    spy.mockRestore();
  });
});
