import { NextResponse } from "next/server";

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
