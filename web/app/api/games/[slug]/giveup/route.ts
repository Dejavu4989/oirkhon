import { NextRequest, NextResponse } from "next/server";
import { giveupAction } from "@/lib/actions";
import { ensureToken } from "../_util";

export async function POST(req: NextRequest) {
  const result = giveupAction(req.cookies.get("oirkhon_token")?.value);
  const res = NextResponse.json(result.body ?? {}, { status: result.status });
  if (result.sessionToken) ensureToken(res, result.sessionToken);
  return res;
}
