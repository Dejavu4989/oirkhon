"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bucketForRank, bucketLabel, bestProgression, shareText } from "@/lib/game";

interface GuessRow { word: string; rank: number; bucket: string }
interface TodayData {
  puzzle_number: number;
  date: string;
  guesses: GuessRow[];
  hints_used: number;
  solved: boolean;
  gave_up: boolean;
  vocab_size: number;
}

const BUCKET_BG: Record<string, string> = {
  hot: "bg-green-500/90", warm: "bg-yellow-400/90",
  cool: "bg-orange-400/90", cold: "bg-gray-500/60", solved: "bg-green-600",
};

export default function GameBoard() {
  const [data, setData] = useState<TodayData | null>(null);
  const [input, setInput] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastIndex, setLastIndex] = useState(-1);
  const [result, setResult] = useState<{ answer?: string; share?: string; nearest?: { word: string; rank: number }[] } | null>(null);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/games/oirkhon/today", { cache: "no-store" });
    if (res.ok) setData(await res.json());
    else setError("Тоглоом одоо нээгээгүй байна.");
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const finalizeShare = useCallback(() => {
    // share text is built client-side from the refreshed board
    setTimeout(async () => {
      const res = await fetch("/api/games/oirkhon/today", { cache: "no-store" });
      if (!res.ok) return;
      const d: TodayData = await res.json();
      setResult((prev) => ({
        ...prev,
        share: shareText(d.puzzle_number, d.guesses.map((g) => g.rank),
          d.hints_used, d.solved),
      }));
    }, 50);
  }, []);

  const submitGuess = useCallback(async () => {
    const word = input.trim();
    if (!word || busy.current) return;
    busy.current = true;
    setError(null); setNotice(null);
    try {
      const res = await fetch("/api/games/oirkhon/guess", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ word }),
      });
      const body = await res.json();
      if (res.status === 422) {
        setError("Энэ үг манай толь бичигт байхгүй байна");
      } else if (res.status === 429) {
        setError("Хэт олон оролдлого — түр хүлээнэ үү");
      } else if (body.status === "duplicate") {
        setNotice("Та аль хэдийн энэ үгийг оруулсан байна");
      } else {
        if (body.correction) setNotice(body.correction);
        setLastIndex((body.guesses_count ?? 1) - 1);
        if (body.solved) {
          setResult({
            answer: body.answer,
            share: undefined, // computed from refreshed state below
          });
        }
      }
      setInput("");
      await refresh();
      if (body.solved) finalizeShare();
    } finally {
      busy.current = false;
    }
  }, [input, refresh, finalizeShare]);

  const askHint = useCallback(async (type: string) => {
    const res = await fetch("/api/games/oirkhon/hint", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ type }),
    });
    const body = await res.json();
    if (res.status === 402) setError("Илүү сэжүүр авахын тулд бүртгүүлнэ үү");
    else if (!res.ok) setError("Сэжүүр авч чадсангүй");
    else setNotice(`Сэжүүр: ${JSON.stringify(body).replace(/[{}"]/g, " ")}`);
    await refresh();
  }, [refresh]);

  const giveUp = useCallback(async () => {
    const res = await fetch("/api/games/oirkhon/giveup", { method: "POST" });
    const body = await res.json();
    if (res.status === 409) setError(`Дор хаяж ${body.need} таалт хийсний дараа бууж өгөх боломжтой`);
    else if (res.ok) {
      setResult({ answer: body.answer, nearest: body.nearest });
      finalizeShare();
    }
    await refresh();
  }, [refresh, finalizeShare]);

  const sorted = useMemo(
    () => [...(data?.guesses ?? [])].sort((a, b) => a.rank - b.rank),
    [data],
  );

  if (error && !data) {
    return <main className="p-6 text-center">{error}</main>;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-3 px-3 pb-24 pt-6">
      <h1 className="text-center text-2xl font-bold">Ойрхон #{data?.puzzle_number ?? "…"} 🇲🇳</h1>
      <p className="text-center text-sm opacity-70">Өнөөдрийн нууц үгийг олоорой</p>

      <form
        className="flex gap-2"
        onSubmit={(e) => { e.preventDefault(); void submitGuess(); }}
      >
        <input
          autoFocus
          className="min-w-0 flex-1 rounded-lg border border-gray-400 bg-transparent px-3 py-2 outline-none focus:border-emerald-500"
          placeholder="Үг оруулна уу"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          enterKeyHint="send"
        />
        <button
          className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white active:bg-emerald-700"
          type="submit"
        >
          Илгээх
        </button>
      </form>

      {notice && <div className="rounded-md bg-blue-500/15 px-3 py-2 text-sm">{notice}</div>}
      {error && <div className="rounded-md bg-red-500/15 px-3 py-2 text-sm">{error}</div>}

      <div className="text-center text-xs opacity-60">
        {data ? `${data.guesses.length} таалт · толь бичиг: ${data.vocab_size.toLocaleString()} үг` : ""}
      </div>

      <ul className="flex flex-col gap-1.5">
        {sorted.map((g) => {
          const idx = data!.guesses.findIndex((x) => x.rank === g.rank && x.word === g.word);
          const fill = Math.round((1 - Math.log(Math.max(g.rank, 1)) / Math.log(data?.vocab_size || 2)) * 100);
          return (
            <li
              key={`${g.word}-${g.rank}`}
              className={`rounded-lg border border-white/10 px-3 py-2 ${
                idx === lastIndex ? "ring-2 ring-emerald-500" : ""
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">{g.word}</span>
                <span className="text-sm tabular-nums opacity-80">
                  {g.rank} · {bucketLabel(g.rank)}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full ${BUCKET_BG[bucketForRank(g.rank)]}`}
                  style={{ width: `${Math.max(fill, 2)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {result?.share && (
        <section className="rounded-xl border border-emerald-500/40 p-4 text-center">
          <p className="text-lg font-bold">Баяр хүргэе! 🎉</p>
          <pre className="mt-2 whitespace-pre-wrap text-sm">{result.share}</pre>
          <div className="mt-3 flex justify-center gap-2">
            <button
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
              onClick={() => void navigator.clipboard.writeText(result.share!)}
            >
              Хуулах
            </button>
            {typeof navigator !== "undefined" && "share" in navigator && (
              <button
                className="rounded-lg border px-4 py-2 text-sm"
                onClick={() => void navigator.share({ text: result.share! })}
              >
                Хуваалцах
              </button>
            )}
          </div>
        </section>
      )}

      {result?.answer && (
        <section className="rounded-xl border p-4 text-center">
          <p className="text-lg font-bold">
            {data?.solved ? "Баяр хүргэе! 🎉" : "Нууц үг:"}
          </p>
          <p className="mt-1 text-xl font-extrabold">{result.answer}</p>
          {result.nearest && (
            <p className="mt-2 text-sm opacity-80">
              Хамгийн ойр үгс: {result.nearest.map((n) => n.word).join(", ")}
            </p>
          )}
        </section>
      )}

      <div className="mt-auto flex justify-center gap-2 pt-4">
        {["letter_count", "first_letter", "nearby_word"].map((t, i) => (
          <button
            key={t}
            className="rounded-lg border px-3 py-1.5 text-xs"
            onClick={() => void askHint(t)}
          >
            Сэжүүр {i + 1}
          </button>
        ))}
        {(data?.guesses.length ?? 0) >= 20 && !data?.solved && (
          <button className="rounded-lg border border-red-500/50 px-3 py-1.5 text-xs" onClick={() => void giveUp()}>
            Бууж өгөх
          </button>
        )}
      </div>
      <div className="text-center text-[11px] opacity-40">
        {bestProgression(data?.guesses.map((g) => g.rank) ?? []).join("")}
      </div>
    </main>
  );
}
