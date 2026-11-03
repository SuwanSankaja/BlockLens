import type { BlockchainAddress, BlockchainAddressStats } from "@/types/blockchain";

export interface AddressStatsSummary {
  /** Total received in sats (chain + mempool); null when the provider omitted it. */
  fundedSats: number | null;
  /** Total spent in sats (chain + mempool); null when the provider omitted it. */
  spentSats: number | null;
  balanceSats: number | null;
  fundedTxoCount: number | null;
  spentTxoCount: number | null;
  chainTxCount: number | null;
  mempoolTxCount: number | null;
  txCount: number | null;
  /** True only when the provider reported zero spent outputs. */
  neverSpent: boolean;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function add(left: number | null, right: number | null): number | null {
  if (left === null && right === null) {
    return null;
  }

  return (left ?? 0) + (right ?? 0);
}

function field(
  chain: Partial<BlockchainAddressStats> | undefined,
  mempool: Partial<BlockchainAddressStats> | undefined,
  key: keyof BlockchainAddressStats,
): number | null {
  return add(num(chain?.[key]), num(mempool?.[key]));
}

/**
 * Computes funded / spent / tx-count figures from provider address stats.
 * Confirmed (chain_stats) and pending (mempool_stats) figures are combined.
 * Missing values stay null so the UI can say "Unknown" instead of 0.
 */
export function computeAddressStats(
  address: Pick<BlockchainAddress, "chain_stats" | "mempool_stats"> | null | undefined,
): AddressStatsSummary {
  const chain = address?.chain_stats;
  const mempool = address?.mempool_stats;
  const fundedSats = field(chain, mempool, "funded_txo_sum");
  const spentSats = field(chain, mempool, "spent_txo_sum");
  const spentTxoCount = field(chain, mempool, "spent_txo_count");

  return {
    fundedSats,
    spentSats,
    balanceSats:
      fundedSats !== null && spentSats !== null ? fundedSats - spentSats : null,
    fundedTxoCount: field(chain, mempool, "funded_txo_count"),
    spentTxoCount,
    chainTxCount: num(chain?.tx_count),
    mempoolTxCount: num(mempool?.tx_count),
    txCount: field(chain, mempool, "tx_count"),
    neverSpent: spentTxoCount === 0 && spentSats === 0,
  };
}
