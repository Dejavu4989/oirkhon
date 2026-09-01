import { NextRequest, NextResponse } from "next/server";
import { guessAction } from "@/lib/actions";
import { ensureToken, puzzleParam, requestCtx } from "../_util";

export async function POST(req: NextRequest) {
  let body: { word?: unknown; n?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: "unknown_word" }, { status: 422 });
  }
  const result = guessAction(await requestCtx(req), body?.word, puzzleParam(req, body));
  const res = NextResponse.json(result.body, { status: result.status });
  if (result.sessionToken) ensureToken(res, result.sessionToken);
  return res;
}
