import { describe, expect, it } from "vitest";
import { computeAddressStats } from "@/lib/graph/addressStats";
import type { BlockchainAddress } from "@/types/blockchain";
import { GENESIS } from "./helpers";

const st = (f: number, fs: number, s: number, ss: number, t: number) => ({
  funded_txo_count: f,
  funded_txo_sum: fs,
  spent_txo_count: s,
  spent_txo_sum: ss,
  tx_count: t,
});

describe("computeAddressStats", () => {
  it("genesis address: spent 0 is genuine, neverSpent true", () => {
    const a: BlockchainAddress = {
      address: GENESIS,
      chain_stats: st(100, 7_000_000_000, 0, 0, 100),
      mempool_stats: st(0, 0, 0, 0, 0),
    };
    const r = computeAddressStats(a);
    expect(r.spentSats).toBe(0);
    expect(r.neverSpent).toBe(true);
    expect(r.fundedSats).toBe(7_000_000_000);
    expect(r.balanceSats).toBe(7_000_000_000);
  });
  it("sums chain and mempool", () => {
    const r = computeAddressStats({
      chain_stats: st(2, 1000, 1, 400, 3),
      mempool_stats: st(1, 500, 1, 100, 2),
    });
    expect(r).toMatchObject({
      fundedSats: 1500,
      spentSats: 500,
      balanceSats: 1000,
      fundedTxoCount: 3,
      spentTxoCount: 2,
      chainTxCount: 3,
      mempoolTxCount: 2,
      txCount: 5,
      neverSpent: false,
    });
  });
  it("mempool-only activity", () => {
    const r = computeAddressStats({
      chain_stats: st(0, 0, 0, 0, 0),
      mempool_stats: st(1, 900, 0, 0, 1),
    });
    expect(r.fundedSats).toBe(900);
    expect(r.txCount).toBe(1);
    expect(r.chainTxCount).toBe(0);
    expect(r.mempoolTxCount).toBe(1);
  });
  it("null/undefined input gives nulls, not zeros", () => {
    for (const input of [null, undefined]) {
      const r = computeAddressStats(input);
      expect(r.fundedSats).toBeNull();
      expect(r.spentSats).toBeNull();
      expect(r.balanceSats).toBeNull();
      expect(r.txCount).toBeNull();
      expect(r.neverSpent).toBe(false);
    }
  });
  it("missing fields stay null; neverSpent false when unknown", () => {
    const r = computeAddressStats({
      chain_stats: { funded_txo_sum: 10 } as never,
      mempool_stats: undefined as never,
    });
    expect(r.fundedSats).toBe(10);
    expect(r.spentSats).toBeNull();
    expect(r.balanceSats).toBeNull();
    expect(r.neverSpent).toBe(false);
  });
  it("non-finite values treated as unknown", () => {
    const r = computeAddressStats({
      chain_stats: { ...st(1, 1, 1, 1, 1), funded_txo_sum: NaN },
      mempool_stats: undefined as never,
    });
    expect(r.fundedSats).toBeNull();
  });
});
