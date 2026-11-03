import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GENESIS, OPTS, TXID, graph, node } from "./helpers";

const fetchMock = vi.fn(async () => {
  throw new Error("network disabled in tests");
});

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const req = (url: string, init?: RequestInit) => new NextRequest(new URL(url, "http://localhost"), init as never);

describe("GET /api/tx/[txid]", () => {
  it.each(["abc", "../../etc/passwd", "z".repeat(64), "a".repeat(63), "%2e%2e", GENESIS])(
    "400 for %s",
    async (id) => {
      const { GET } = await import("@/app/api/tx/[txid]/route");
      const res = await GET(req("/api/tx/x"), { params: Promise.resolve({ txid: id }) });
      expect(res.status).toBe(400);
      expect((await res.json()).ok).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});

describe("GET /api/address/[address]", () => {
  it.each(["", "abc", "../../foo", TXID, GENESIS + "/../x", "<script>"])("400 for %j", async (a) => {
    const { GET } = await import("@/app/api/address/[address]/route");
    const res = await GET(req("/api/address/x"), { params: Promise.resolve({ address: a }) });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/search", () => {
  it.each(["", "abc", "../../foo", "x".repeat(300)])("400 for q=%j", async (q) => {
    const { GET } = await import("@/app/api/search/route");
    const res = await GET(req(`/api/search?q=${encodeURIComponent(q)}`));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("invalid_input");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("400 with no q param", async () => {
    const { GET } = await import("@/app/api/search/route");
    expect((await GET(req("/api/search"))).status).toBe(400);
  });
});

describe("POST /api/expand", () => {
  const post = async (body: unknown, raw = false) => {
    const { POST } = await import("@/app/api/expand/route");
    return POST(
      req("/api/expand", {
        method: "POST",
        body: raw ? (body as string) : JSON.stringify(body),
        headers: { "content-type": "application/json" },
      }),
    );
  };
  it("400 for invalid JSON", async () => {
    expect((await post("{not json", true)).status).toBe(400);
  });
  it("400 for empty/missing fields", async () => {
    expect((await post({})).status).toBe(400);
    expect((await post(null)).status).toBe(400);
  });
  it("400 for path-injection ids", async () => {
    const res = await post({
      targetNodeId: "address:../../foo",
      targetNodeType: "address",
      graph: graph([node("address:../../foo")], []),
      options: OPTS,
    });
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.error.code).toBe("invalid_request");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("400 for oversized graph", async () => {
    const nodes = Array.from({ length: 1001 }, (_, i) => node(`address:n${i}`));
    const res = await post({
      targetNodeId: `address:${GENESIS}`,
      targetNodeType: "address",
      graph: graph(nodes, []),
      options: OPTS,
    });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
