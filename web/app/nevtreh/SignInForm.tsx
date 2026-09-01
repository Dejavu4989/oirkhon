"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { IconGoogle } from "../components/Icons";
import { useViewer } from "../components/useViewer";

type Mode = "login" | "signup";

const GOOGLE_ERRORS: Record<string, string> = {
  google_off: "Google-ээр нэвтрэх тохируулагдаагүй байна.",
  google_denied: "Google-ээр нэвтрэхийг цуцаллаа.",
  google_state: "Хүсэлт хугацаа нь дууссан байна. Дахин оролдоно уу.",
  google_no_code: "Google-ээс хариу ирсэнгүй.",
  google_failed: "Google-ээр нэвтрэхэд алдаа гарлаа.",
};

export default function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, accountsEnabled, googleEnabled, loading, reload } = useViewer();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const code = params.get("error");
    if (code) setError(GOOGLE_ERRORS[code] ?? "Нэвтрэхэд алдаа гарлаа.");
  }, [params]);

  // Already signed in: nothing to do here.
  useEffect(() => {
    if (!loading && user) router.replace("/oirkhon");
  }, [loading, user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          mode === "signup" ? { email, password, display_name: name } : { email, password },
        ),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Алдаа гарлаа.");
        return;
      }
      await reload();
      router.push("/oirkhon");
      router.refresh();
    } catch {
      setError("Сүлжээний алдаа. Дахин оролдоно уу.");
    } finally {
      setBusy(false);
    }
  }

  if (!loading && !accountsEnabled) {
    return (
      <main className="mx-auto w-full max-w-[420px] flex-1 px-4 pt-24">
        <h1 className="text-3xl font-black tracking-tight">Нэвтрэх</h1>
        <p className="mt-4 text-[14px] leading-relaxed text-muted">
          Бүртгэлийн систем идэвхгүй байна. Тоглоомыг бүртгэлгүйгээр үргэлжлүүлэн тоглох боломжтой.
        </p>
        <Link href="/oirkhon" className="mt-6 inline-block text-[14px] font-semibold text-hot hover:underline">
          ← Тоглоом руу буцах
        </Link>
      </main>
    );
  }

  const field =
    "w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[15px] outline-none transition-colors focus:border-muted";

  return (
    <main className="mx-auto w-full max-w-[420px] flex-1 px-4 pb-20 pt-24">
      <h1 className="text-center text-4xl font-black tracking-tight">Ойрхон</h1>
      <p className="mt-2 text-center text-[13px] text-muted">
        {mode === "login"
          ? "Бүртгэлдээ нэвтэрч, түүх, цувааг хадгалаарай."
          : "Шинэ бүртгэл үүсгэж, тоглолтоо хадгалаарай."}
      </p>

      <div className="mt-7 flex rounded-lg bg-surface p-1">
        {(["login", "signup"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setError(null); }}
            className={`flex-1 rounded-md py-2 text-[14px] font-semibold transition-colors ${
              mode === m ? "bg-surface2 text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {m === "login" ? "Нэвтрэх" : "Бүртгүүлэх"}
          </button>
        ))}
      </div>

      <form className="mt-5 flex flex-col gap-3" onSubmit={submit}>
        {mode === "signup" && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-muted">Нэр</span>
            <input className={field} value={name} onChange={(e) => setName(e.target.value)}
                   placeholder="Таны нэр" autoComplete="name" />
          </label>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-muted">И-мэйл</span>
          <input className={field} type="email" required value={email}
                 onChange={(e) => setEmail(e.target.value)}
                 placeholder="ta@example.mn" autoComplete="email" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-muted">Нууц үг</span>
          <input className={field} type="password" required value={password}
                 onChange={(e) => setPassword(e.target.value)}
                 placeholder="Дор хаяж 8 тэмдэгт"
                 autoComplete={mode === "login" ? "current-password" : "new-password"} />
        </label>

        {error && (
          <p className="rounded-lg bg-cold/25 px-3 py-2 text-[13px]">{error}</p>
        )}

        <button type="submit" disabled={busy}
                className="mt-1 rounded-lg bg-hot px-4 py-2.5 text-[15px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
          {busy ? "Түр хүлээнэ үү…" : mode === "login" ? "Нэвтрэх" : "Бүртгүүлэх"}
        </button>
      </form>

      {googleEnabled && (
        <>
          <div className="my-5 flex items-center gap-3 text-[12px] text-muted">
            <span className="h-px flex-1 bg-line" /> эсвэл <span className="h-px flex-1 bg-line" />
          </div>
          <a href="/api/auth/google"
             className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-line bg-surface px-4 py-2.5 text-[15px] font-semibold transition-colors hover:bg-surface2">
            <IconGoogle className="h-[18px] w-[18px]" />
            Google-ээр нэвтрэх
          </a>
        </>
      )}

      <p className="mt-6 text-center text-[13px] text-muted">
        <Link href="/oirkhon" className="hover:text-ink">Бүртгэлгүйгээр тоглох →</Link>
      </p>
    </main>
  );
}
