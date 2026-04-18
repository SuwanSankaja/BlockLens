import { createEsploraApi } from "@/lib/blockchain/esplora";
import { createMempoolApi } from "@/lib/blockchain/mempool";
import { createFetchContext, normalizeProviderError } from "@/lib/blockchain/http";
import type {
  ApiErrorShape,
  BlockchainAddress,
  BlockchainApi,
  BlockchainOutspend,
  BlockchainTransaction,
  FetchContext,
  ProviderResponse,
  SearchEntityResult,
} from "@/types/blockchain";

type ProviderCallResult =
  | BlockchainAddress
  | BlockchainOutspend
  | BlockchainOutspend[]
  | BlockchainTransaction
  | BlockchainTransaction[]
  | SearchEntityResult
  | null;

const providers: BlockchainApi[] = [createMempoolApi(), createEsploraApi()];

function buildFallbackWarning(providerName: string, message: string): string {
  return `Primary provider ${providerName} failed: ${message}`;
}

async function callWithFallback<T extends ProviderCallResult>(
  operation: (provider: BlockchainApi) => Promise<T>,
): Promise<ProviderResponse<T>> {
  const warnings: string[] = [];
  let lastError: Error | null = null;

  for (let index = 0; index < providers.length; index += 1) {
    const provider = providers[index];

    try {
      const data = await operation(provider);
      return {
        data,
        provider: provider.name,
        warnings,
      };
    } catch (error) {
      const normalized = normalizeProviderError(error, provider.name);
      lastError = normalized;

      if (index < providers.length - 1) {
        warnings.push(buildFallbackWarning(provider.name, normalized.message));
        continue;
      }
    }
  }

  throw lastError;
}

export const blockchainProvider = {
  createContext: createFetchContext,
  searchEntity(input: string, context: FetchContext) {
    return callWithFallback<SearchEntityResult>((provider) =>
      provider.searchEntity(input, context),
    );
  },
  getTransaction(txid: string, context: FetchContext) {
    return callWithFallback<BlockchainTransaction>((provider) =>
      provider.getTransaction(txid, context),
    );
  },
  getTransactionOutspends(txid: string, context: FetchContext) {
    return callWithFallback<BlockchainOutspend[]>((provider) =>
      provider.getTransactionOutspends(txid, context),
    );
  },
  getAddress(address: string, context: FetchContext) {
    return callWithFallback<BlockchainAddress>((provider) =>
      provider.getAddress(address, context),
    );
  },
  getAddressTransactions(address: string, context: FetchContext) {
    return callWithFallback<BlockchainTransaction[]>((provider) =>
      provider.getAddressTransactions(address, context),
    );
  },
  getSpendingTransaction(txid: string, vout: number, context: FetchContext) {
    return callWithFallback<BlockchainOutspend | null>((provider) =>
      provider.getSpendingTransaction(txid, vout, context),
    );
  },
};

export function mergeProviderWarnings(...warningGroups: string[][]): string[] {
  return [...new Set(warningGroups.flat().filter(Boolean))];
}

export function toApiErrorShape(error: unknown): ApiErrorShape {
  const normalized = normalizeProviderError(error, "mempool");

  return {
    code: normalized.code,
    message: normalized.message,
    status: normalized.status,
    retryable: normalized.retryable,
    details: normalized.details,
  };
}
