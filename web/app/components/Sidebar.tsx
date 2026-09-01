"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  IconChevron, IconClose, IconMail, IconMegaphone, IconRefresh, IconX, IconYoutube,
} from "./Icons";

interface ActivityDay {
  date: string; day: number; month: number; played: boolean; isToday: boolean;
}

const GAMES = [
  { slug: "oirkhon", name: "ОЙРХОН", live: true,
    blurb: "Өдөр бүр нэг нууц үг. Утгын ойролцоо байдлаар нь ойртуулж олоорой." },
  { slug: "useglel", name: "ҮСЭГЛЭЛ", live: false,
    blurb: "Өгөгдсөн үсгүүдээс аль болох олон үг зохио." },
  { slug: "khaana-ve", name: "ХААНА ВЭ?", live: false,
    blurb: "Газрын зургаас өдрийн байршлыг тааварла." },
];

/** ms until the next 00:00 in Asia/Ulaanbaatar — when the puzzle rolls over. */
function msUntilReset(now: Date = new Date()): number {
  const ub = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Ulaanbaatar" }));
  const next = new Date(ub);
  next.setHours(24, 0, 0, 0);
  return Math.max(0, next.getTime() - ub.getTime());
}

function hhmmss(ms: number): string {
  const s = Math.floor(ms / 1000);
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60]
    .map((n) => String(n).padStart(2, "0")).join(":");
}

/**
 * The strip is a rolling week, so near the start of a month it spans two of
 * them. Calling that "9-р сарын идэвх" while showing 26–31 August is what made
 * it look broken, so the heading only names a month when the week is inside one.
 */
function activityHeading(days: ActivityDay[]): string {
  if (!days.length) return " ";
  const months = new Set(days.map((d) => d.month));
  return months.size === 1 ? `${days[0].month}-Р САРЫН ИДЭВХ` : "СҮҮЛИЙН 7 ХОНОГ";
}

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState<string | null>("oirkhon");
  const [days, setDays] = useState<ActivityDay[]>([]);
  const [left, setLeft] = useState<number | null>(null);

  const loadActivity = useCallback(async () => {
    try {
      const res = await fetch("/api/games/oirkhon/activity", { cache: "no-store" });
      if (res.ok) setDays((await res.json()).days ?? []);
    } catch { /* offline: pills just stay empty */ }
  }, []);

  useEffect(() => { void loadActivity(); }, [loadActivity]);

  // Clock work happens after mount so server and client markup agree.
  useEffect(() => {
    setLeft(msUntilReset());
    const id = setInterval(() => setLeft(msUntilReset()), 1000);
    return () => clearInterval(id);
  }, []);

  const streak = days.filter((d) => d.played).length;
  const today = days.find((d) => d.isToday);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-rail px-6 py-6">
      <div className="flex items-start justify-between">
        <Link href="/oirkhon" className="text-[28px] font-black leading-none tracking-tight">
          Ойрхон
        </Link>
        {onClose && (
          <button onClick={onClose} aria-label="Хаах"
                  className="-mr-1 text-muted transition-colors hover:text-ink">
            <IconClose />
          </button>
        )}
      </div>

      <nav className="mt-9 flex flex-col">
        {GAMES.map((g) => {
          const isOpen = open === g.slug;
          return (
            <div key={g.slug} className="border-b border-line/60">
              <button
                onClick={() => setOpen(isOpen ? null : g.slug)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between py-3.5 text-left text-[15px] font-extrabold tracking-wide transition-colors hover:text-ink"
              >
                <span className={g.live ? "text-ink" : "text-muted"}>{g.name}</span>
                <span className={`text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}>
                  <IconChevron />
                </span>
              </button>
              {isOpen && (
                <div className="pb-4 pr-2 text-[13px] leading-relaxed text-muted">
                  <p>{g.blurb}</p>
                  {g.live ? (
                    <Link href={`/${g.slug}`} onClick={onClose}
                          className="mt-2 inline-block font-semibold text-hot hover:underline">
                      Тоглох →
                    </Link>
                  ) : (
                    <span className="mt-2 inline-block rounded bg-surface px-2 py-0.5 text-[11px] font-semibold">
                      Тун удахгүй
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <section className="mt-8">
        <div className="flex items-center gap-2 text-[11px] font-bold tracking-widest text-muted">
          <span>{activityHeading(days)}</span>
          <button onClick={() => void loadActivity()} aria-label="Шинэчлэх"
                  className="transition-colors hover:text-ink">
            <IconRefresh />
          </button>
          <span className="tabular-nums">{left === null ? "" : hhmmss(left)}</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {days.map((d) => (
            <span
              key={d.date}
              title={`${d.date}${d.played ? " — тоглосон" : ""}`}
              className={[
                "flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold tabular-nums",
                d.played ? "bg-hot text-white" : "bg-surface text-muted",
                // Today is always identifiable, played or not.
                d.isToday ? "ring-2 ring-ink/70 ring-offset-2 ring-offset-[color:var(--bg-rail)]" : "",
              ].join(" ")}
            >
              {d.day}
            </span>
          ))}
        </div>

        <p className="mt-3 text-[12px] leading-relaxed text-muted">
          {today?.played
            ? `Өнөөдрийг тэмдэглэлээ. 7 хоногт ${streak} өдөр.`
            : "Өнөөдөр хараахан тоглоогүй байна — цувааг үргэлжлүүл!"}
        </p>
      </section>

      <div className="mt-auto pt-10">
        <a href="mailto:tuguldur9894@gmail.com?subject=Ойрхон%20санал%20хүсэлт"
           className="flex w-full items-center justify-center gap-2 rounded-lg bg-surface px-3 py-2.5 text-[13px] font-semibold transition-colors hover:bg-surface2">
          <IconMegaphone /> Санал хүсэлт
        </a>
        <a href="mailto:tuguldur9894@gmail.com?subject=Хамтран%20ажиллах"
           className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg bg-surface px-3 py-2.5 text-[13px] font-semibold transition-colors hover:bg-surface2">
          Бидэнтэй ажиллах уу?
        </a>

        <div className="mt-2.5 flex items-center justify-center gap-6 rounded-lg bg-surface py-2.5 text-muted">
          <a href="https://x.com" target="_blank" rel="noreferrer noopener" aria-label="X"
             className="transition-colors hover:text-ink"><IconX /></a>
          <a href="https://youtube.com" target="_blank" rel="noreferrer noopener" aria-label="YouTube"
             className="transition-colors hover:text-ink"><IconYoutube /></a>
          <a href="mailto:tuguldur9894@gmail.com" aria-label="Имэйл"
             className="transition-colors hover:text-ink"><IconMail /></a>
        </div>

        <div className="mt-5 text-center text-[12px] text-muted">
          <Link href="/changelog" className="hover:text-ink">Өөрчлөлтийн түүх</Link>
          <div className="mt-2 flex justify-center gap-4">
            <Link href="/terms" className="hover:text-ink">Үйлчилгээний нөхцөл</Link>
            <Link href="/privacy" className="hover:text-ink">Нууцлалын бодлого</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
