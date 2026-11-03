import { NextRequest, NextResponse } from "next/server";

import { toApiErrorShape } from "@/lib/blockchain/provider";
import { expandGraphOneHop } from "@/lib/graph/expandGraph";
import { validateExpandRequest } from "@/lib/graph/validateExpand";

const MAX_BODY_BYTES = 2 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    let rawBody: unknown = null;

    if (!(declaredLength > MAX_BODY_BYTES)) {
      const text = await request.text();

      if (text.length <= MAX_BODY_BYTES) {
        try {
          rawBody = JSON.parse(text);
        } catch {
          rawBody = null;
        }
      }
    }

    const validation = validateExpandRequest(rawBody);

    if (!validation.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "invalid_request",
            message: validation.message,
            status: 400,
          },
        },
        {
          status: 400,
        },
      );
    }

    const body = validation.request;
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
