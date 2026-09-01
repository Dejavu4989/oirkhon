import { NextRequest, NextResponse } from "next/server";
import type { Ctx } from "@/lib/actions";
import { SESSION_COOKIE, getViewer } from "@/lib/auth";

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "local";
}

export function ensureToken(res: NextResponse, token: string): void {
  res.cookies.set("oirkhon_token", token, {
    httpOnly: true,       // spec §7
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

/** Who is playing: the signed-in account if there is one, else the anon cookie. */
export async function requestCtx(req: NextRequest): Promise<Ctx> {
  return {
    viewer: await getViewer(req.cookies.get(SESSION_COOKIE)?.value),
    token: req.cookies.get("oirkhon_token")?.value,
    ip: clientIp(req),
  };
}

/** `?n=` selects an archive puzzle; absent means today. */
export function puzzleParam(req: NextRequest, body?: { n?: unknown }): number | undefined {
  const raw = body?.n ?? new URL(req.url).searchParams.get("n");
  if (raw === null || raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  return Number.isInteger(n) ? n : undefined;
}
