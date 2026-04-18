import {
  addWarning,
  createAddressNode,
  createGraphAccumulator,
  createTransactionNode,
  finalizeGraph,
  getAddressNodeId,
  getTransactionNodeId,
  markNodeExpanded,
  resolveAddressReference,
  upsertEdge,
  upsertNode,
  type GraphAccumulator,
} from "@/lib/graph/normalize";
import type { AddressBundle, TransactionBundle } from "@/types/blockchain";
import type { GraphBuildOptions, GraphData } from "@/types/graph";

const MAX_ADDRESS_TRANSACTIONS = 12;
export const MAX_GRAPH_DEPTH = 20;

export const DEFAULT_GRAPH_OPTIONS: GraphBuildOptions = {
  confirmedOnly: false,
  minValueSats: 0,
  hideTinyOutputs: false,
  tinyOutputThresholdSats: 546,
  maxDepth: 1,
  maxNodes: 200,
  hideVisited: false,
};

function parseNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function parseBoolean(value: string | null, fallback: boolean): boolean {
  if (value === null) {
    return fallback;
  }

  return value === "true" || value === "1";
}

export function coerceGraphBuildOptions(
  input?: Partial<GraphBuildOptions>,
): GraphBuildOptions {
  return {
    confirmedOnly: input?.confirmedOnly ?? DEFAULT_GRAPH_OPTIONS.confirmedOnly,
    minValueSats: Math.max(
      0,
      parseNumber(input?.minValueSats, DEFAULT_GRAPH_OPTIONS.minValueSats),
    ),
    hideTinyOutputs:
      input?.hideTinyOutputs ?? DEFAULT_GRAPH_OPTIONS.hideTinyOutputs,
    tinyOutputThresholdSats: Math.max(
      0,
      parseNumber(
        input?.tinyOutputThresholdSats,
        DEFAULT_GRAPH_OPTIONS.tinyOutputThresholdSats,
      ),
    ),
    maxDepth: Math.min(
      MAX_GRAPH_DEPTH,
      Math.max(1, Math.floor(parseNumber(input?.maxDepth, DEFAULT_GRAPH_OPTIONS.maxDepth))),
    ),
    maxNodes: Math.min(
      200,
      Math.max(25, Math.floor(parseNumber(input?.maxNodes, DEFAULT_GRAPH_OPTIONS.maxNodes))),
    ),
    hideVisited: input?.hideVisited ?? DEFAULT_GRAPH_OPTIONS.hideVisited,
  };
}

export function parseGraphBuildOptions(searchParams: URLSearchParams): GraphBuildOptions {
  return coerceGraphBuildOptions({
    confirmedOnly: parseBoolean(searchParams.get("confirmedOnly"), false),
    minValueSats: Number(searchParams.get("minValueSats") ?? 0),
    hideTinyOutputs: parseBoolean(searchParams.get("hideTinyOutputs"), false),
    tinyOutputThresholdSats: Number(
      searchParams.get("tinyOutputThresholdSats") ?? 546,
    ),
    maxDepth: Number(searchParams.get("maxDepth") ?? DEFAULT_GRAPH_OPTIONS.maxDepth),
    maxNodes: Number(searchParams.get("maxNodes") ?? 200),
    hideVisited: parseBoolean(searchParams.get("hideVisited"), false),
  });
}

function shouldIncludeValue(
  value: number,
  options: GraphBuildOptions,
): boolean {
  if (value < options.minValueSats) {
    return false;
  }

  if (options.hideTinyOutputs && value < options.tinyOutputThresholdSats) {
    return false;
  }

  return true;
}

function shouldIncludeTransaction(
  confirmed: boolean | undefined,
  options: GraphBuildOptions,
  isRoot: boolean,
): boolean {
  if (!options.confirmedOnly) {
    return true;
  }

  return isRoot || confirmed === true;
}

export function appendTransactionNeighborhood(
  acc: GraphAccumulator,
  bundle: TransactionBundle,
  options: GraphBuildOptions,
  depth: number,
  {
    isRoot = false,
  }: {
    isRoot?: boolean;
  } = {},
): void {
  const tx = bundle.transaction;
  const txNodeId = getTransactionNodeId(tx.txid);

  if (!shouldIncludeTransaction(tx.status.confirmed, options, isRoot)) {
    addWarning(acc, {
      code: "transaction_filtered",
      message: "Transaction was filtered out by the confirmed-only setting.",
    });
    return;
  }

  upsertNode(
    acc,
    createTransactionNode(tx.txid, tx, {
      confirmed: tx.status.confirmed,
      fee: tx.fee,
      size: tx.size,
      weight: tx.weight,
      blockTime: tx.status.block_time,
    }),
    depth,
  );

  if (isRoot) {
    acc.traversal.rootNodeId = txNodeId;
  }

  tx.vin.forEach((vin, vinIndex) => {
    const prevout = vin.prevout;

    if (!prevout || !shouldIncludeValue(prevout.value, options)) {
      return;
    }

    const addressRef = resolveAddressReference({
      txid: tx.txid,
      index: vinIndex,
      address: prevout.scriptpubkey_address,
      scriptpubkey: prevout.scriptpubkey,
      scriptpubkeyType: prevout.scriptpubkey_type,
      direction: "input",
    });

    const inputAddressId = getAddressNodeId(addressRef.address);
    const inserted = upsertNode(
      acc,
      createAddressNode(addressRef.address, null, {
        ...addressRef.metadata,
        label: addressRef.label,
        heuristic: true,
        note:
          "Input address relationships are inferred from prevout script data, not entity ownership.",
      }),
      depth + 1,
    );

    if (!inserted) {
      return;
    }

    upsertEdge(acc, {
      id: `edge:input:${inputAddressId}:${txNodeId}:${vinIndex}`,
      from: inputAddressId,
      to: txNodeId,
      type: "input",
      value: prevout.value,
      metadata: {
        vinIndex,
        heuristic: true,
        previousTxid: vin.txid,
        previousVout: vin.vout,
      },
    });
  });

  tx.vout.forEach((vout, voutIndex) => {
    if (!shouldIncludeValue(vout.value, options)) {
      return;
    }

    const addressRef = resolveAddressReference({
      txid: tx.txid,
      index: voutIndex,
      address: vout.scriptpubkey_address,
      scriptpubkey: vout.scriptpubkey,
      scriptpubkeyType: vout.scriptpubkey_type,
      direction: "output",
    });

    const outputAddressId = getAddressNodeId(addressRef.address);
    const inserted = upsertNode(
      acc,
      createAddressNode(addressRef.address, null, {
        ...addressRef.metadata,
        label: addressRef.label,
        outputIndex: voutIndex,
        value: vout.value,
      }),
      depth + 1,
    );

    if (!inserted) {
      return;
    }

    upsertEdge(acc, {
      id: `edge:output:${txNodeId}:${outputAddressId}:${voutIndex}`,
      from: txNodeId,
      to: outputAddressId,
      type: "output",
      value: vout.value,
      metadata: {
        voutIndex,
        spent: bundle.outspends[voutIndex]?.spent ?? false,
      },
    });

    const outspend = bundle.outspends[voutIndex];

    if (!outspend?.spent || !outspend.txid) {
      return;
    }

    if (!shouldIncludeTransaction(outspend.status?.confirmed, options, false)) {
      return;
    }

    const spendingNodeId = getTransactionNodeId(outspend.txid);
    const spendingInserted = upsertNode(
      acc,
      createTransactionNode(outspend.txid, null, {
        confirmed: outspend.status?.confirmed ?? false,
        placeholder: true,
        blockTime: outspend.status?.block_time,
      }),
      depth + 1,
    );

    if (!spendingInserted) {
      return;
    }

    upsertEdge(acc, {
      id: `edge:spent:${txNodeId}:${spendingNodeId}:${voutIndex}`,
      from: txNodeId,
      to: spendingNodeId,
      type: "spent_by",
      value: vout.value,
      metadata: {
        voutIndex,
        spent: true,
      },
    });
  });

  markNodeExpanded(acc, txNodeId);
}

export function appendAddressNeighborhood(
  acc: GraphAccumulator,
  bundle: AddressBundle,
  options: GraphBuildOptions,
  depth: number,
  {
    isRoot = false,
  }: {
    isRoot?: boolean;
  } = {},
): void {
  const rootAddress = bundle.address.address;
  const rootNodeId = getAddressNodeId(rootAddress);
  const transactions = bundle.transactions.slice(0, MAX_ADDRESS_TRANSACTIONS);

  if (bundle.transactions.length > MAX_ADDRESS_TRANSACTIONS) {
    addWarning(acc, {
      code: "address_transactions_capped",
      message: `Showing the ${MAX_ADDRESS_TRANSACTIONS} most recent address transactions in the initial graph.`,
    });
  }

  upsertNode(
    acc,
    createAddressNode(rootAddress, bundle.address, {
      fundedTxoSum: bundle.address.chain_stats.funded_txo_sum,
      spentTxoSum: bundle.address.chain_stats.spent_txo_sum,
      txCount: bundle.address.chain_stats.tx_count,
    }),
    depth,
  );

  if (isRoot) {
    acc.traversal.rootNodeId = rootNodeId;
  }

  transactions.forEach((tx) => {
    if (!shouldIncludeTransaction(tx.status.confirmed, options, false)) {
      return;
    }

    const txNodeId = getTransactionNodeId(tx.txid);
    const inserted = upsertNode(
      acc,
      createTransactionNode(tx.txid, tx, {
        confirmed: tx.status.confirmed,
        fee: tx.fee,
        blockTime: tx.status.block_time,
      }),
      depth + 1,
    );

    if (!inserted) {
      return;
    }

    let rootInputValue = 0;
    let rootReceivedValue = 0;

    tx.vin.forEach((vin, vinIndex) => {
      const prevout = vin.prevout;

      if (!prevout || !shouldIncludeValue(prevout.value, options)) {
        return;
      }

      if (prevout.scriptpubkey_address === rootAddress) {
        rootInputValue += prevout.value;
        return;
      }

      const addressRef = resolveAddressReference({
        txid: tx.txid,
        index: vinIndex,
        address: prevout.scriptpubkey_address,
        scriptpubkey: prevout.scriptpubkey,
        scriptpubkeyType: prevout.scriptpubkey_type,
        direction: "input",
      });

      const inputAddressId = getAddressNodeId(addressRef.address);
      const inputInserted = upsertNode(
        acc,
        createAddressNode(addressRef.address, null, {
          ...addressRef.metadata,
          label: addressRef.label,
          heuristic: true,
          note:
            "Input address relationships are inferred from prevout script data, not ownership.",
        }),
        depth + 1,
      );

      if (!inputInserted) {
        return;
      }

      upsertEdge(acc, {
        id: `edge:input:${inputAddressId}:${txNodeId}:${vinIndex}`,
        from: inputAddressId,
        to: txNodeId,
        type: "input",
        value: prevout.value,
        metadata: {
          vinIndex,
          heuristic: true,
        },
      });
    });

    tx.vout.forEach((vout, voutIndex) => {
      if (!shouldIncludeValue(vout.value, options)) {
        return;
      }

      if (vout.scriptpubkey_address === rootAddress) {
        rootReceivedValue += vout.value;
        return;
      }

      const addressRef = resolveAddressReference({
        txid: tx.txid,
        index: voutIndex,
        address: vout.scriptpubkey_address,
        scriptpubkey: vout.scriptpubkey,
        scriptpubkeyType: vout.scriptpubkey_type,
        direction: "output",
      });

      const outputAddressId = getAddressNodeId(addressRef.address);
      const outputInserted = upsertNode(
        acc,
        createAddressNode(addressRef.address, null, {
          ...addressRef.metadata,
          label: addressRef.label,
          outputIndex: voutIndex,
          value: vout.value,
        }),
        depth + 1,
      );

      if (!outputInserted) {
        return;
      }

      upsertEdge(acc, {
        id: `edge:output:${txNodeId}:${outputAddressId}:${voutIndex}`,
        from: txNodeId,
        to: outputAddressId,
        type: "output",
        value: vout.value,
        metadata: {
          voutIndex,
        },
      });
    });

    if (rootInputValue > 0) {
      upsertEdge(acc, {
        id: `edge:root-input:${rootNodeId}:${txNodeId}`,
        from: rootNodeId,
        to: txNodeId,
        type: "input",
        value: rootInputValue,
        metadata: {
          heuristic: true,
        },
      });
    }

    if (rootReceivedValue > 0) {
      upsertEdge(acc, {
        id: `edge:root-received:${txNodeId}:${rootNodeId}`,
        from: txNodeId,
        to: rootNodeId,
        type: "received_by",
        value: rootReceivedValue,
        metadata: {
          explicit: true,
        },
      });
    }
  });

  markNodeExpanded(acc, rootNodeId);
}

export function buildTransactionGraph(
  bundle: TransactionBundle,
  options: GraphBuildOptions,
): GraphData {
  const acc = createGraphAccumulator(undefined, options.maxNodes);
  appendTransactionNeighborhood(acc, bundle, options, 0, { isRoot: true });
  return finalizeGraph(acc);
}

export function buildAddressGraph(
  bundle: AddressBundle,
  options: GraphBuildOptions,
): GraphData {
  const acc = createGraphAccumulator(undefined, options.maxNodes);
  appendAddressNeighborhood(acc, bundle, options, 0, { isRoot: true });
  return finalizeGraph(acc);
}
