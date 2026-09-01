import { NextRequest, NextResponse } from "next/server";
import { hintAction } from "@/lib/actions";
import { ensureToken, puzzleParam, requestCtx } from "../_util";

// The hint takes no arguments beyond which puzzle: there is a single kind, and
// what it reveals is derived from how close the player already is.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const result = hintAction(await requestCtx(req), puzzleParam(req, body));
  const res = NextResponse.json(result.body ?? {}, { status: result.status });
  if (result.sessionToken) ensureToken(res, result.sessionToken);
  return res;
}
