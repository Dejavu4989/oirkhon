import { NextRequest, NextResponse } from "next/server";
import { activityPayload } from "@/lib/actions";
import { requestCtx } from "../_util";

export async function GET(req: NextRequest) {
  return NextResponse.json({ days: activityPayload(await requestCtx(req)) });
}
