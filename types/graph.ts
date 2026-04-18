import type {
  AddressBundle,
  BlockchainAddress,
  BlockchainTransaction,
  ProviderName,
  SearchEntityKind,
  TransactionBundle,
} from "@/types/blockchain";

export type GraphNodeType = "transaction" | "address";

export type GraphEdgeType = "input" | "output" | "spent_by" | "received_by";

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  raw: BlockchainTransaction | BlockchainAddress | null;
  metadata: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: GraphEdgeType;
  value?: number;
  metadata: Record<string, unknown>;
}

export interface GraphTraversalState {
  rootNodeId: string;
  expandedNodeIds: string[];
  nodeDepthById: Record<string, number>;
}

export interface GraphWarning {
  code: string;
  message: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  traversal: GraphTraversalState;
  warnings: GraphWarning[];
  truncated: boolean;
  maxNodes: number;
}

export interface GraphBuildOptions {
  confirmedOnly: boolean;
  minValueSats: number;
  hideTinyOutputs: boolean;
  tinyOutputThresholdSats: number;
  maxDepth: number;
  maxNodes: number;
  hideVisited: boolean;
}

export interface SearchSummary {
  kind: SearchEntityKind;
  provider: ProviderName;
  query: string;
  warnings: GraphWarning[];
  addressBundle?: AddressBundle;
  transactionBundle?: TransactionBundle;
  graph: GraphData;
}

export interface SearchApiResponse {
  ok: true;
  summary: SearchSummary;
}

export interface ErrorApiResponse {
  ok: false;
  error: {
    code: string;
    message: string;
    status: number;
    retryable?: boolean;
  };
}

export type SearchRouteResponse = SearchApiResponse | ErrorApiResponse;

export interface ExpandGraphRequest {
  targetNodeId: string;
  targetNodeType: GraphNodeType;
  graph: GraphData;
  options: GraphBuildOptions;
}

export interface ExpandGraphResponse {
  ok: true;
  graph: GraphData;
  provider: ProviderName;
  warnings: GraphWarning[];
}

export interface SummaryCardItem {
  label: string;
  value: string;
  hint?: string;
}
