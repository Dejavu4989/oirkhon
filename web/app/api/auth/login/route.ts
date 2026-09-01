import { NextRequest, NextResponse } from "next/server";
import { createSession, login } from "@/lib/auth";
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
  if (!allowHit(`login:${ip}`, 20, 15 * 60_000)) {
    return NextResponse.json({ error: "Хэт олон оролдлого — дараа оролдоно уу." }, { status: 429 });
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Мэдээлэл буруу." }, { status: 400 });
  }

  const viewer = await login(body.email, body.password);
  if (!viewer) {
    // Never say which half was wrong — that would confirm the address exists.
    return NextResponse.json({ error: "И-мэйл эсвэл нууц үг буруу." }, { status: 401 });
  }

  adoptAnonPlays(req.cookies.get("oirkhon_token")?.value, viewer.id);

  const res = NextResponse.json({ user: publicViewer(viewer) });
  setSessionCookie(res, await createSession(viewer.id));
  return res;
}
