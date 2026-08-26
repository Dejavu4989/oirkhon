import { NextRequest, NextResponse } from "next/server";
import { hintAction } from "@/lib/actions";
import { ensureToken } from "../_util";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "body шаардлагатай" }, { status: 400 });
  }
  const type = (body as { type?: unknown })?.type;
  const result = hintAction(type, req.cookies.get("oirkhon_token")?.value);
  const res = NextResponse.json(result.body ?? {}, { status: result.status });
  if (result.sessionToken) ensureToken(res, result.sessionToken);
  return res;
}
