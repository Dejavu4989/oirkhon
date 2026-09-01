import { NextResponse } from "next/server";
import { SESSION_COOKIE, type Viewer } from "@/lib/auth";

const SESSION_DAYS = 60;

export function setSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 0,
  });
}

/** What the browser is allowed to know about the signed-in user. */
export function publicViewer(v: Viewer) {
  return {
    id: v.id,
    email: v.email,
    display_name: v.displayName,
    avatar_url: v.avatarUrl,
    is_subscribed: v.isSubscribed,
    subscription_expires_at: v.subscriptionExpiresAt,
  };
}
