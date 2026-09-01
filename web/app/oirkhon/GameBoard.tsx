"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { barWidth, bucketForRank, bucketLabel, shareText } from "@/lib/game";
import { IconBulb, IconDots, IconFlag, IconSearch, IconShare, IconStar } from "../components/Icons";

interface GuessRow { word: string; rank: number; bucket: string }
interface HintRow { type: string; payload: { word: string; rank: number } }
interface BoardData {
  puzzle_number: number;
  date: string;
  is_archive: boolean;
  guesses: GuessRow[];
  hints: HintRow[];
  hints_used: number;
  hints_allowed: number;
  solved: boolean;
  gave_up: boolean;
  vocab_size: number;
  answer: string | null;
  nearest: { word: string; rank: number }[] | null;
}

/** One line on the board. */
interface Row { word: string; rank: number; fromHint: boolean; isAnswer: boolean }

const BAR: Record<string, string> = {
  solved: "bg-hot", hot: "bg-hot", warm: "bg-warm", cool: "bg-cold", cold: "bg-cold",
};

const GIVEUP_AFTER = 20;

export default function GameBoard() {
  const params = useSearchParams();
  const archiveN = params.get("n");
  const suffix = archiveN ? `?n=${encodeURIComponent(archiveN)}` : "";
  const bodyN = archiveN ? { n: Number(archiveN) } : {};

  const [data, setData] = useState<BoardData | null>(null);
  const [locked, setLocked] = useState(false);
  const [input, setInput] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastWord, setLastWord] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/oirkhon/today${suffix}`, { cache: "no-store" });
      if (res.ok) {
        setData(await res.json());
        setLocked(false);
      } else if (res.status === 402) {
        setLocked(true);
      } else {
        setError("Өнөөдрийн тоглоом хараахан нээгдээгүй байна.");
      }
    } catch {
      setError("Сүлжээний алдаа. Дахин оролдоно уу.");
    }
  }, [suffix]);

  useEffect(() => { void refresh(); }, [refresh]);

  const finished = Boolean(data?.solved || data?.gave_up);
  const guessCount = data?.guesses.length ?? 0;
  const hintsUsed = data?.hints_used ?? 0;
  const hintsAllowed = data?.hints_allowed ?? 3;
  const hintsLeft = Math.max(hintsAllowed - hintsUsed, 0);

  // Guesses and hint-revealed words share one ranked list. Once the game is
  // over the answer sits at the very top, whether it was solved or given up —
  // it is the thing the board is about, so it must not be buried at the bottom.
  const rows: Row[] = useMemo(() => {
    if (!data) return [];
    const byWord = new Map<string, Row>();
    for (const g of data.guesses) {
      byWord.set(g.word, { word: g.word, rank: g.rank, fromHint: false, isAnswer: g.rank === 1 });
    }
    for (const h of data.hints) {
      if (!byWord.has(h.payload.word)) {
        byWord.set(h.payload.word, {
          word: h.payload.word, rank: h.payload.rank, fromHint: true, isAnswer: false,
        });
      }
    }
    if (finished && data.answer && !byWord.has(data.answer)) {
      byWord.set(data.answer, {
        word: data.answer, rank: 1, fromHint: false, isAnswer: true,
      });
    }
    return [...byWord.values()].sort((a, b) => a.rank - b.rank);
  }, [data, finished]);

  const share = useMemo(() => {
    if (!data || !finished) return null;
    return shareText(data.puzzle_number, data.guesses.map((g) => g.rank),
                     data.hints_used, data.solved);
  }, [data, finished]);

  const post = useCallback(async (path: string, extra: Record<string, unknown> = {}) => {
    const res = await fetch(`/api/games/oirkhon/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...bodyN, ...extra }),
    });
    return { res, body: await res.json().catch(() => ({})) };
  }, [bodyN]);

  const submitGuess = useCallback(async () => {
    const word = input.trim();
    if (!word || busy.current) return;
    busy.current = true;
    setError(null); setNotice(null);
    try {
      const { res, body } = await post("guess", { word });
      if (res.status === 422) {
        setError("«" + word + "» — энэ үг манай толь бичигт алга.");
      } else if (res.status === 429) {
        setError("Хэт олон таалт — түр хүлээнэ үү.");
      } else if (res.status === 402) {
        setLocked(true);
      } else if (body.status === "duplicate") {
        setNotice("«" + body.word + "» үгийг аль хэдийн оруулсан байна.");
        setLastWord(body.word);
        setInput("");
      } else if (res.ok) {
        if (body.correction) setNotice(body.correction);
        setLastWord(body.word);
        setInput("");
      }
      await refresh();
    } finally {
      busy.current = false;
    }
  }, [input, post, refresh]);

  const askHint = useCallback(async () => {
    setMenu(false); setError(null); setNotice(null);
    const { res, body } = await post("hint");
    if (res.ok) {
      setNotice("Сэжүүр: «" + body.word + "» — эрэмбэ " + body.rank + ".");
      setLastWord(body.word);
    } else if (res.status === 402) {
      setError(hintsAllowed > 3
        ? "Өнөөдрийн сэжүүр дууслаа."
        : "3 үнэгүй сэжүүр дууслаа. Захиалагчид өдөрт 10 сэжүүр авдаг.");
    } else if (body.status === "needs_guess") {
      setError("Эхлээд нэг үг таагаад үзээрэй — сэжүүр таны байрлалаас хамаарна.");
    } else if (body.status === "no_closer") {
      setError("Үүнээс ойр үг үлдсэнгүй — хариу маш ойрхон байна!");
    } else if (body.status === "finished") {
      setError("Тоглолт аль хэдийн дууссан.");
    } else if (res.status === 429) {
      setError("Хэт олон хүсэлт — түр хүлээнэ үү.");
    } else {
      setError("Сэжүүр авч чадсангүй.");
    }
    await refresh();
  }, [post, refresh, hintsAllowed]);

  const giveUp = useCallback(async () => {
    setMenu(false); setError(null); setNotice(null);
    const { res, body } = await post("giveup");
    if (res.status === 409) {
      setError("Дор хаяж " + body.need + " таалт хийсний дараа бууж өгөх боломжтой.");
    } else if (res.status === 429) {
      setError("Хэт олон хүсэлт — түр хүлээнэ үү.");
    }
    await refresh();
  }, [post, refresh]);

  const copyShare = useCallback(async () => {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Хуулж чадсангүй.");
    }
  }, [share]);

  if (locked) {
    return (
      <main className="mx-auto w-full max-w-[520px] flex-1 px-4 pt-24 text-center">
        <p className="flex items-center justify-center gap-2 text-[17px] font-bold">
          <IconStar className="h-4 w-4 text-warm" /> Архивын тоглоом
        </p>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          Өмнөх өдрүүдийн тоглоомыг захиалагчид тоглох боломжтой.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/nevtreh"
                className="rounded-lg bg-hot px-5 py-2 text-[14px] font-bold text-white">
            Нэвтрэх
          </Link>
          <Link href="/oirkhon"
                className="rounded-lg border border-line px-5 py-2 text-[14px] font-semibold">
            Өнөөдрийн тоглоом
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[640px] flex-1 px-4 pb-24 pt-[4.5rem] sm:pt-20">
      <h1 className="text-center text-[52px] font-black leading-none tracking-tighter sm:text-[64px]">
        Ойрхон
      </h1>

      {data?.is_archive && (
        <p className="mt-3 text-center text-[12px] text-muted">
          Архив · {data.date} ·{" "}
          <Link href="/oirkhon" className="font-semibold hover:text-ink">Өнөөдрийн тоглоом →</Link>
        </p>
      )}

      <form className="relative mt-8 flex gap-2"
            onSubmit={(e) => { e.preventDefault(); void submitGuess(); }}>
        <div className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-xl bg-surface px-4">
          <IconSearch className="h-4 w-4 shrink-0 text-muted" />
          <input
            autoFocus
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="send"
            disabled={finished}
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted disabled:opacity-50"
            placeholder="Үг оруулна уу..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <span className="shrink-0 text-[13px] font-bold text-muted">
            #{data?.puzzle_number ?? "—"}
          </span>
        </div>

        {/* Hints are the main assist, so the button lives on the board itself. */}
        <button
          type="button"
          onClick={() => void askHint()}
          disabled={finished || hintsLeft === 0}
          title={`Сэжүүр авах — ${hintsLeft}/${hintsAllowed} үлдсэн`}
          aria-label={`Сэжүүр авах, ${hintsLeft} үлдсэн`}
          className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-warm/20 text-warm transition-colors hover:bg-warm/30 disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted disabled:opacity-50"
        >
          <IconBulb className="h-5 w-5" />
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-warm px-1 text-[10px] font-black text-black">
            {hintsLeft}
          </span>
        </button>

        <button type="button" aria-label="Цэс" aria-expanded={menu}
                onClick={() => setMenu((v) => !v)}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface text-muted transition-colors hover:text-ink">
          <IconDots className="h-5 w-5" />
        </button>

        {menu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
            <div className="absolute right-0 top-14 z-20 w-60 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-xl">
              <button onClick={() => void giveUp()}
                      disabled={finished || guessCount < GIVEUP_AFTER}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[14px] transition-colors hover:bg-surface2 disabled:opacity-40">
                <IconFlag className="h-4 w-4 shrink-0" />
                Бууж өгөх
                {guessCount < GIVEUP_AFTER && (
                  <span className="ml-auto text-[12px] text-muted">
                    {GIVEUP_AFTER - guessCount} үлдсэн
                  </span>
                )}
              </button>
              {share && (
                <button onClick={() => void copyShare()}
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[14px] transition-colors hover:bg-surface2">
                  <IconShare className="h-4 w-4 shrink-0" />
                  {copied ? "Хуулагдлаа!" : "Хуваалцах"}
                </button>
              )}
              <Link href="/archive" onClick={() => setMenu(false)}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[14px] transition-colors hover:bg-surface2">
                <IconStar className="h-4 w-4 shrink-0" /> Архив
              </Link>
            </div>
          </>
        )}
      </form>

      {notice && <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-[13px]">{notice}</p>}
      {error && <p className="mt-3 rounded-lg bg-cold/25 px-3 py-2 text-[13px]">{error}</p>}

      <div className="mt-5 border-t border-line" />

      {rows.length > 0 && (
        <p className="mt-3 text-right text-[12px] text-muted">
          {guessCount} таалт{hintsUsed > 0 ? " · " + hintsUsed + " сэжүүр" : ""}
        </p>
      )}

      <ul className="mt-3 flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.word}
              className={"row-in relative flex h-[52px] items-center overflow-hidden rounded-md bg-white/[0.03] "
                + (r.isAnswer ? "ring-2 ring-hot " : "")
                + (r.word === lastWord && !r.isAnswer ? "ring-1 ring-white/25" : "")}>
            {/* The bar scales inside a track that stops short of the rank
                column, so a near-perfect guess can never run under its number. */}
            <div className="absolute inset-y-0 left-0 right-[72px]">
              <div className={"h-full rounded-md " + BAR[bucketForRank(r.rank)]}
                   style={{ width: (barWidth(r.rank, data?.vocab_size ?? 20000) * 100) + "%" }} />
            </div>
            <span className="relative z-10 flex min-w-0 items-center gap-1.5 pl-3.5 pr-2">
              {r.fromHint && (
                <span className="shrink-0 text-white/70" title="Сэжүүрээр илэрсэн">
                  <IconBulb className="h-3.5 w-3.5" />
                </span>
              )}
              <span className="truncate text-[15px] font-bold">{r.word}</span>
              {r.isAnswer && (
                <span className="shrink-0 rounded bg-black/30 px-1.5 py-0.5 text-[10px] font-black tracking-wide">
                  ХАРИУ
                </span>
              )}
            </span>
            <span className="relative z-10 ml-auto shrink-0 pr-4 text-[15px] font-bold tabular-nums"
                  title={bucketLabel(r.rank)}>
              {r.rank}
            </span>
          </li>
        ))}
      </ul>

      {rows.length === 0 && !error && (
        <p className="mt-10 text-center text-[13px] text-muted">
          Ямар нэг үг оруулаад эхлээрэй. Хамгийн ойр нь дээшээ эрэмбэлэгдэнэ.
        </p>
      )}

      {finished && data?.answer && (
        <section className="mt-6 rounded-xl border border-line p-5 text-center">
          <p className="text-[13px] text-muted">
            {data.solved ? "Баяр хүргэе!" : "Нууц үг байсан нь"}
          </p>
          <p className="mt-1 text-3xl font-black tracking-tight">{data.answer}</p>
          {data.nearest && data.nearest.length > 0 && (
            <p className="mt-3 text-[13px] leading-relaxed text-muted">
              Хамгийн ойр үгс: {data.nearest.map((n) => n.word).join(", ")}
            </p>
          )}
          {share && (
            <>
              <pre className="mt-4 whitespace-pre-wrap text-[13px] leading-relaxed">{share}</pre>
              <button onClick={() => void copyShare()}
                      className="mt-3 rounded-lg bg-hot px-5 py-2 text-[14px] font-bold text-white transition-opacity hover:opacity-90">
                {copied ? "Хуулагдлаа!" : "Хуулах"}
              </button>
            </>
          )}
        </section>
      )}
    </main>
  );
}
