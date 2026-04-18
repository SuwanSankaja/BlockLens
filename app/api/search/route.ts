import { NextRequest, NextResponse } from "next/server";

import { blockchainProvider, mergeProviderWarnings, toApiErrorShape } from "@/lib/blockchain/provider";
import {
  buildAddressGraph,
  buildTransactionGraph,
  parseGraphBuildOptions,
} from "@/lib/graph/buildGraph";
import { detectBitcoinInputType } from "@/lib/utils/validateBitcoinInput";
import type { GraphWarning, SearchRouteResponse } from "@/types/graph";

function warningFromMessage(message: string, index: number): GraphWarning {
  return {
    code: `provider_warning_${index + 1}`,
    message,
  };
}

function cacheHeaders() {
  return {
    "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get("q")?.trim() ?? "";
  const options = parseGraphBuildOptions(searchParams);

  const detected = detectBitcoinInputType(query);

  if (!detected.isValid || detected.kind === "unknown") {
    const response: SearchRouteResponse = {
      ok: false,
      error: {
        code: "invalid_input",
        message: detected.reason ?? "Invalid Bitcoin txid or address.",
        status: 400,
        retryable: false,
      },
    };

    return NextResponse.json(response, {
      status: 400,
    });
  }

  try {
    const context = blockchainProvider.createContext();
    const searchResult = await blockchainProvider.searchEntity(query, context);

    if (searchResult.data.kind === "transaction") {
      const [transactionResponse, outspendsResponse] = await Promise.all([
        blockchainProvider.getTransaction(searchResult.data.normalized, context),
        blockchainProvider.getTransactionOutspends(searchResult.data.normalized, context),
      ]);

      const warnings = mergeProviderWarnings(
        searchResult.warnings,
        transactionResponse.warnings,
        outspendsResponse.warnings,
      ).map(warningFromMessage);

      const transactionBundle = {
        transaction: transactionResponse.data,
        outspends: outspendsResponse.data,
      };
      const graph = buildTransactionGraph(transactionBundle, options);
      const response: SearchRouteResponse = {
        ok: true,
        summary: {
          kind: "transaction",
          provider: transactionResponse.provider,
          query: searchResult.data.normalized,
          warnings: [...warnings, ...graph.warnings],
          transactionBundle,
          graph,
        },
      };

      return NextResponse.json(response, {
        headers: cacheHeaders(),
      });
    }

    const [addressResponse, transactionsResponse] = await Promise.all([
      blockchainProvider.getAddress(searchResult.data.normalized, context),
      blockchainProvider.getAddressTransactions(searchResult.data.normalized, context),
    ]);

    const warnings = mergeProviderWarnings(
      searchResult.warnings,
      addressResponse.warnings,
      transactionsResponse.warnings,
    ).map(warningFromMessage);

    const addressBundle = {
      address: addressResponse.data,
      transactions: transactionsResponse.data,
    };
    const graph = buildAddressGraph(addressBundle, options);
    const response: SearchRouteResponse = {
      ok: true,
      summary: {
        kind: "address",
        provider: addressResponse.provider,
        query: searchResult.data.normalized,
        warnings: [...warnings, ...graph.warnings],
        addressBundle,
        graph,
      },
    };

    return NextResponse.json(response, {
      headers: cacheHeaders(),
    });
  } catch (error) {
    const apiError = toApiErrorShape(error);
    const response: SearchRouteResponse = {
      ok: false,
      error: {
        code: apiError.code,
        message: apiError.message,
        status: apiError.status,
        retryable: apiError.retryable,
      },
    };

    return NextResponse.json(response, {
      status: apiError.status,
    });
  }
}
