import { NextRequest, NextResponse } from "next/server";
import { giveupAction } from "@/lib/actions";
import { ensureToken, puzzleParam, requestCtx } from "../_util";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const result = giveupAction(await requestCtx(req), puzzleParam(req, body));
  const res = NextResponse.json(result.body ?? {}, { status: result.status });
  if (result.sessionToken) ensureToken(res, result.sessionToken);
  return res;
}
