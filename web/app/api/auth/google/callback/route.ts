import { NextRequest, NextResponse } from "next/server";
import { createSession, upsertGoogleUser } from "@/lib/auth";
import { isDbConfigured } from "@/lib/db";
import { STATE_COOKIE, exchangeCode, googleConfigured } from "@/lib/google";
import { adoptAnonPlays } from "@/lib/store";
import { setSessionCookie } from "../../_util";

function fail(req: NextRequest, reason: string) {
  return NextResponse.redirect(new URL(`/nevtreh?error=${reason}`, req.url));
}

export async function GET(req: NextRequest) {
  if (!isDbConfigured() || !googleConfigured()) return fail(req, "google_off");

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = req.cookies.get(STATE_COOKIE)?.value;

  if (url.searchParams.get("error")) return fail(req, "google_denied");
  if (!code) return fail(req, "google_no_code");
  if (!state || !expected || state !== expected) return fail(req, "google_state");

  let viewer;
  try {
    viewer = await upsertGoogleUser(await exchangeCode(code, url.origin));
  } catch (err) {
    console.error("[auth] google sign-in failed:", err);
    return fail(req, "google_failed");
  }

  adoptAnonPlays(req.cookies.get("oirkhon_token")?.value, viewer.id);

  const res = NextResponse.redirect(new URL("/oirkhon", req.url));
  setSessionCookie(res, await createSession(viewer.id));
  res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
