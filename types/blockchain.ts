export type ProviderName = "mempool" | "esplora";

export type SearchEntityKind = "transaction" | "address";

export interface BlockchainTransactionStatus {
  confirmed: boolean;
  block_height?: number;
  block_hash?: string;
  block_time?: number;
}

export interface BlockchainVout {
  scriptpubkey: string;
  scriptpubkey_asm?: string;
  scriptpubkey_type?: string;
  scriptpubkey_address?: string;
  value: number;
}

export interface BlockchainVin {
  txid?: string;
  vout?: number;
  prevout?: BlockchainVout | null;
  scriptsig?: string;
  scriptsig_asm?: string;
  witness?: string[];
  is_coinbase: boolean;
  sequence: number;
}

export interface BlockchainTransaction {
  txid: string;
  version: number;
  locktime: number;
  size: number;
  weight: number;
  fee?: number;
  status: BlockchainTransactionStatus;
  vin: BlockchainVin[];
  vout: BlockchainVout[];
}

export interface BlockchainOutspend {
  spent: boolean;
  txid?: string;
  vin?: number;
  status?: BlockchainTransactionStatus;
}

export interface BlockchainAddressStats {
  funded_txo_count: number;
  funded_txo_sum: number;
  spent_txo_count: number;
  spent_txo_sum: number;
  tx_count: number;
}

export interface BlockchainAddress {
  address: string;
  chain_stats: BlockchainAddressStats;
  mempool_stats: BlockchainAddressStats;
}

export interface SearchEntityResult {
  kind: SearchEntityKind;
  normalized: string;
}

export interface ProviderResponse<T> {
  data: T;
  provider: ProviderName;
  warnings: string[];
}

export interface TransactionBundle {
  transaction: BlockchainTransaction;
  outspends: BlockchainOutspend[];
}

export interface AddressBundle {
  address: BlockchainAddress;
  transactions: BlockchainTransaction[];
}

export interface FetchContext {
  requestId: string;
}

export interface BlockchainApi {
  readonly name: ProviderName;
  getTransaction(txid: string, context: FetchContext): Promise<BlockchainTransaction>;
  getTransactionOutspends(
    txid: string,
    context: FetchContext,
  ): Promise<BlockchainOutspend[]>;
  getAddress(address: string, context: FetchContext): Promise<BlockchainAddress>;
  getAddressTransactions(
    address: string,
    context: FetchContext,
  ): Promise<BlockchainTransaction[]>;
  getSpendingTransaction(
    txid: string,
    vout: number,
    context: FetchContext,
  ): Promise<BlockchainOutspend | null>;
  searchEntity(input: string, context: FetchContext): Promise<SearchEntityResult>;
}

export interface ApiErrorShape {
  code: string;
  message: string;
  status: number;
  retryable?: boolean;
  details?: string;
}
