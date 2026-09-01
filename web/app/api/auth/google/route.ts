import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { isDbConfigured } from "@/lib/db";
import { STATE_COOKIE, authUrl, googleConfigured } from "@/lib/google";

export async function GET(req: NextRequest) {
  if (!isDbConfigured() || !googleConfigured()) {
    return NextResponse.redirect(new URL("/nevtreh?error=google_off", req.url));
  }
  // CSRF guard: the callback only proceeds if it echoes this value back.
  const state = randomBytes(16).toString("base64url");
  const res = NextResponse.redirect(authUrl(new URL(req.url).origin, state));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
