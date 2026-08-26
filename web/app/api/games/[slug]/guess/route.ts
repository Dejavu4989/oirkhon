import { NextRequest, NextResponse } from "next/server";
import { guessAction } from "@/lib/actions";
import { clientIp, ensureToken } from "../_util";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    console.error("[guess] invalid JSON body");
    return NextResponse.json({ status: "unknown_word" }, { status: 422 });
  }
  const word = (body as { word?: unknown })?.word;
  const result = guessAction({
    token: req.cookies.get("oirkhon_token")?.value,
    ip: clientIp(req),
    word,
  });
  const res = NextResponse.json(result.body, { status: result.status });
  if (result.sessionToken) ensureToken(res, result.sessionToken);
  return res;
}
