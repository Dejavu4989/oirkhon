import { NextRequest, NextResponse } from "next/server";
import { createSession, signup } from "@/lib/auth";
import { isDbConfigured } from "@/lib/db";
import { allowHit } from "@/lib/ratelimit";
import { adoptAnonPlays } from "@/lib/store";
import { clientIp } from "../../games/[slug]/_util";
import { publicViewer, setSessionCookie } from "../_util";

export async function POST(req: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: "Бүртгэл идэвхгүй байна." }, { status: 503 });
  }
  const ip = clientIp(req);
  // Account creation is expensive (a scrypt hash each time) and abusable.
  if (!allowHit(`signup:${ip}`, 5, 60 * 60_000)) {
    return NextResponse.json({ error: "Хэт олон оролдлого — дараа оролдоно уу." }, { status: 429 });
  }

  let body: { email?: unknown; password?: unknown; display_name?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Мэдээлэл буруу." }, { status: 400 });
  }

  const result = await signup(body.email, body.password, body.display_name);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // Carry today's anonymous progress into the new account.
  adoptAnonPlays(req.cookies.get("oirkhon_token")?.value, result.viewer.id);

  const res = NextResponse.json({ user: publicViewer(result.viewer) });
  setSessionCookie(res, await createSession(result.viewer.id));
  return res;
}
