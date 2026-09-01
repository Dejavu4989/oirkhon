import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, getViewer } from "@/lib/auth";
import { isDbConfigured } from "@/lib/db";
import { googleConfigured } from "@/lib/google";
import { publicViewer } from "../_util";

export async function GET(req: NextRequest) {
  const viewer = await getViewer(req.cookies.get(SESSION_COOKIE)?.value);
  return NextResponse.json({
    user: viewer ? publicViewer(viewer) : null,
    accounts_enabled: isDbConfigured(),
    google_enabled: googleConfigured(),
  });
}
