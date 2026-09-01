"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconCheck, IconLock, IconStar } from "../components/Icons";

interface Entry {
  puzzle_number: number;
  date: string;
  played: boolean;
  solved: boolean;
  locked: boolean;
}

export default function ArchiveList() {
  const [puzzles, setPuzzles] = useState<Entry[]>([]);
  const [subscribed, setSubscribed] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/games/oirkhon/archive", { cache: "no-store" });
        if (res.ok) {
          const body = await res.json();
          setPuzzles(body.puzzles ?? []);
          setSubscribed(Boolean(body.subscribed));
          setSignedIn(Boolean(body.signed_in));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="mx-auto w-full max-w-[640px] flex-1 px-4 pb-24 pt-[4.5rem] sm:pt-20">
      <h1 className="text-center text-[40px] font-black leading-none tracking-tighter">Архив</h1>
      <p className="mt-3 text-center text-[13px] text-muted">
        Өнгөрсөн өдрүүдийн нууц үгс.
      </p>

      {!loading && !subscribed && (
        <section className="mt-6 rounded-xl border border-warm/40 bg-warm/10 p-5 text-center">
          <p className="flex items-center justify-center gap-2 text-[15px] font-bold">
            <IconStar className="h-4 w-4 text-warm" /> Захиалагчдад зориулав
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            Өмнөх өдрүүдийн тоглоомыг тоглохын тулд захиалга шаардлагатай.
            Захиалагчид өдөрт 10 сэжүүр авах боломжтой.
          </p>
          {!signedIn && (
            <Link href="/nevtreh"
                  className="mt-4 inline-block rounded-lg bg-hot px-5 py-2 text-[14px] font-bold text-white transition-opacity hover:opacity-90">
              Нэвтрэх
            </Link>
          )}
        </section>
      )}

      {loading && <p className="mt-10 text-center text-[13px] text-muted">Ачааллаж байна…</p>}

      {!loading && puzzles.length === 0 && (
        <p className="mt-10 text-center text-[13px] text-muted">
          Архивд тоглоом байхгүй байна — Ойрхон дөнгөж эхэлж байна.
        </p>
      )}

      <ul className="mt-6 flex flex-col gap-2">
        {puzzles.map((p) => {
          const row = (
            <>
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="text-[15px] font-bold tabular-nums">#{p.puzzle_number}</span>
                <span className="truncate text-[13px] text-muted">{p.date}</span>
              </span>
              <span className="ml-auto flex items-center gap-2 text-[12px]">
                {p.solved && (
                  <span className="flex items-center gap-1 font-semibold text-hot">
                    <IconCheck className="h-3.5 w-3.5" /> Бөглөсөн
                  </span>
                )}
                {!p.solved && p.played && <span className="text-muted">Эхэлсэн</span>}
                {p.locked && <IconLock className="h-4 w-4 text-muted" />}
              </span>
            </>
          );

          return (
            <li key={p.puzzle_number}>
              {p.locked ? (
                <div className="flex h-[52px] items-center gap-3 rounded-lg border border-line px-4 opacity-60">
                  {row}
                </div>
              ) : (
                <Link href={`/oirkhon?n=${p.puzzle_number}`}
                      className="flex h-[52px] items-center gap-3 rounded-lg border border-line px-4 transition-colors hover:border-muted hover:bg-surface">
                  {row}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-8 text-center text-[13px]">
        <Link href="/oirkhon" className="text-muted hover:text-ink">← Өнөөдрийн тоглоом</Link>
      </p>
    </main>
  );
}
