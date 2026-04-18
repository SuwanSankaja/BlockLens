import { NextRequest, NextResponse } from "next/server";

import { toApiErrorShape } from "@/lib/blockchain/provider";
import { expandGraphOneHop } from "@/lib/graph/expandGraph";
import type { ExpandGraphRequest } from "@/types/graph";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ExpandGraphRequest;

    if (!body?.targetNodeId || !body?.targetNodeType || !body?.graph) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "invalid_request",
            message: "Expand request is missing required fields.",
            status: 400,
          },
        },
        {
          status: 400,
        },
      );
    }

    const response = await expandGraphOneHop(body);

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
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
