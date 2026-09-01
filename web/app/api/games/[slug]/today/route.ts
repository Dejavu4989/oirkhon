import { NextRequest, NextResponse } from "next/server";
import { boardPayload } from "@/lib/actions";
import { ensureToken, puzzleParam, requestCtx } from "../_util";

export async function GET(req: NextRequest) {
  const result = boardPayload(await requestCtx(req), puzzleParam(req));
  const res = NextResponse.json(result.body, { status: result.status });
  if (result.sessionToken) ensureToken(res, result.sessionToken);
  return res;
}
