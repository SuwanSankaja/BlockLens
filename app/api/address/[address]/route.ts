import { NextRequest, NextResponse } from "next/server";

import { blockchainProvider, mergeProviderWarnings, toApiErrorShape } from "@/lib/blockchain/provider";
import { buildAddressGraph, parseGraphBuildOptions } from "@/lib/graph/buildGraph";
import { detectBitcoinInputType } from "@/lib/utils/validateBitcoinInput";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;

  const detected = detectBitcoinInputType(address);

  if (!detected.isValid || detected.kind !== "address") {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "invalid_address",
          message: "Address is not valid.",
          status: 400,
        },
      },
      { status: 400 },
    );
  }

  try {
    const context = blockchainProvider.createContext();
    const options = parseGraphBuildOptions(request.nextUrl.searchParams);
    const [addressResponse, transactionsResponse] = await Promise.all([
      blockchainProvider.getAddress(address, context),
      blockchainProvider.getAddressTransactions(address, context),
    ]);
    const bundle = {
      address: addressResponse.data,
      transactions: transactionsResponse.data,
    };
    const graph = buildAddressGraph(bundle, options);

    return NextResponse.json(
      {
        ok: true,
        provider: addressResponse.provider,
        warnings: mergeProviderWarnings(
          addressResponse.warnings,
          transactionsResponse.warnings,
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
