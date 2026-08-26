import { NextRequest, NextResponse } from "next/server";
import { todayPayload } from "@/lib/actions";
import { ensureToken } from "../_util";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("oirkhon_token")?.value;
  const result = todayPayload(token);
  if ("error" in result && result.status === 404) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  const res = NextResponse.json(result.body);
  ensureToken(res, result.sessionToken!);
  return res;
}
