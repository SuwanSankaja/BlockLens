import { fetchJsonWithRetry, ProviderError } from "@/lib/blockchain/http";
import { detectBitcoinInputType } from "@/lib/utils/validateBitcoinInput";
import type {
  BlockchainAddress,
  BlockchainApi,
  BlockchainOutspend,
  BlockchainTransaction,
  FetchContext,
  SearchEntityResult,
} from "@/types/blockchain";

// Swap this to your own mempool/esplora-compatible deployment later without
// changing any client components or route handlers.
const MEMPOOL_BASE_URL =
  process.env.BLOCKLENS_MEMPOOL_BASE_URL ?? "https://mempool.space/api";

function assertSearchableInput(input: string): SearchEntityResult {
  const detected = detectBitcoinInputType(input);

  if (!detected.isValid || detected.kind === "unknown") {
    throw new ProviderError({
      message: detected.reason ?? "Invalid Bitcoin txid or address.",
      code: "invalid_input",
      status: 400,
      provider: "mempool",
      retryable: false,
    });
  }

  return {
    kind: detected.kind,
    normalized: detected.normalized,
  };
}

export function createMempoolApi(): BlockchainApi {
  return {
    name: "mempool",
    getTransaction(txid: string, context: FetchContext) {
      return fetchJsonWithRetry<BlockchainTransaction>({
        provider: "mempool",
        baseUrl: MEMPOOL_BASE_URL,
        path: `/tx/${txid}`,
        context,
      });
    },
    getTransactionOutspends(txid: string, context: FetchContext) {
      return fetchJsonWithRetry<BlockchainOutspend[]>({
        provider: "mempool",
        baseUrl: MEMPOOL_BASE_URL,
        path: `/tx/${txid}/outspends`,
        context,
      });
    },
    getAddress(address: string, context: FetchContext) {
      return fetchJsonWithRetry<BlockchainAddress>({
        provider: "mempool",
        baseUrl: MEMPOOL_BASE_URL,
        path: `/address/${address}`,
        context,
      });
    },
    getAddressTransactions(address: string, context: FetchContext) {
      return fetchJsonWithRetry<BlockchainTransaction[]>({
        provider: "mempool",
        baseUrl: MEMPOOL_BASE_URL,
        path: `/address/${address}/txs`,
        context,
      });
    },
    async getSpendingTransaction(txid: string, vout: number, context: FetchContext) {
      const result = await fetchJsonWithRetry<BlockchainOutspend>({
        provider: "mempool",
        baseUrl: MEMPOOL_BASE_URL,
        path: `/tx/${txid}/outspend/${vout}`,
        context,
      });

      return result.spent ? result : null;
    },
    async searchEntity(input: string) {
      return assertSearchableInput(input);
    },
  };
}
