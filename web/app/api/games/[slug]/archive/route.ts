import { NextRequest, NextResponse } from "next/server";
import { archiveList } from "@/lib/actions";
import { requestCtx } from "../_util";

export async function GET(req: NextRequest) {
  const ctx = await requestCtx(req);
  return NextResponse.json({
    puzzles: archiveList(ctx),
    subscribed: Boolean(ctx.viewer?.isSubscribed),
    signed_in: Boolean(ctx.viewer),
  });
}
