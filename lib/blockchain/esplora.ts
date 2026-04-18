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

// This gives us a public fallback today, and a clean seam for self-hosting later.
const ESPLORA_BASE_URL =
  process.env.BLOCKLENS_ESPLORA_BASE_URL ?? "https://blockstream.info/api";

function assertSearchableInput(input: string): SearchEntityResult {
  const detected = detectBitcoinInputType(input);

  if (!detected.isValid || detected.kind === "unknown") {
    throw new ProviderError({
      message: detected.reason ?? "Invalid Bitcoin txid or address.",
      code: "invalid_input",
      status: 400,
      provider: "esplora",
      retryable: false,
    });
  }

  return {
    kind: detected.kind,
    normalized: detected.normalized,
  };
}

export function createEsploraApi(): BlockchainApi {
  return {
    name: "esplora",
    getTransaction(txid: string, context: FetchContext) {
      return fetchJsonWithRetry<BlockchainTransaction>({
        provider: "esplora",
        baseUrl: ESPLORA_BASE_URL,
        path: `/tx/${txid}`,
        context,
      });
    },
    getTransactionOutspends(txid: string, context: FetchContext) {
      return fetchJsonWithRetry<BlockchainOutspend[]>({
        provider: "esplora",
        baseUrl: ESPLORA_BASE_URL,
        path: `/tx/${txid}/outspends`,
        context,
      });
    },
    getAddress(address: string, context: FetchContext) {
      return fetchJsonWithRetry<BlockchainAddress>({
        provider: "esplora",
        baseUrl: ESPLORA_BASE_URL,
        path: `/address/${address}`,
        context,
      });
    },
    getAddressTransactions(address: string, context: FetchContext) {
      return fetchJsonWithRetry<BlockchainTransaction[]>({
        provider: "esplora",
        baseUrl: ESPLORA_BASE_URL,
        path: `/address/${address}/txs`,
        context,
      });
    },
    async getSpendingTransaction(txid: string, vout: number, context: FetchContext) {
      const result = await fetchJsonWithRetry<BlockchainOutspend>({
        provider: "esplora",
        baseUrl: ESPLORA_BASE_URL,
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
