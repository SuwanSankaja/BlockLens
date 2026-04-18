import { NextRequest, NextResponse } from "next/server";

import { blockchainProvider, mergeProviderWarnings, toApiErrorShape } from "@/lib/blockchain/provider";
import { buildTransactionGraph, parseGraphBuildOptions } from "@/lib/graph/buildGraph";
import { detectBitcoinInputType } from "@/lib/utils/validateBitcoinInput";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ txid: string }> },
) {
  const { txid } = await params;

  const detected = detectBitcoinInputType(txid);

  if (!detected.isValid || detected.kind !== "transaction") {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "invalid_txid",
          message: "Transaction ID is not valid.",
          status: 400,
        },
      },
      { status: 400 },
    );
  }

  try {
    const context = blockchainProvider.createContext();
    const options = parseGraphBuildOptions(request.nextUrl.searchParams);
    const [transactionResponse, outspendsResponse] = await Promise.all([
      blockchainProvider.getTransaction(txid, context),
      blockchainProvider.getTransactionOutspends(txid, context),
    ]);
    const bundle = {
      transaction: transactionResponse.data,
      outspends: outspendsResponse.data,
    };
    const graph = buildTransactionGraph(bundle, options);

    return NextResponse.json(
      {
        ok: true,
        provider: transactionResponse.provider,
        warnings: mergeProviderWarnings(
          transactionResponse.warnings,
          outspendsResponse.warnings,
        ),
        bundle,
        graph,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
        },
      },
    );
  } catch (error) {
    const apiError = toApiErrorShape(error);

    return NextResponse.json(
      {
        ok: false,
        error: apiError,
      },
      {
        status: apiError.status,
      },
    );
  }
}
