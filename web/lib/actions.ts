// Game actions — shared by API routes and tests. The answer string must never
// appear in any client-facing payload before solve/give-up [LOCKED spec §2].
import { bucketForRank, bucketLabel, progressFill } from "./game";
import { getLexicon, loadExport } from "./lexicon";
import { allowHit, resetLimits } from "./ratelimit";
import {
  getOrCreatePlay, savePlay, type PlayState,
} from "./store";
import type { ScheduleEntry } from "./lexicon";

export const GAME_SLUG = "oirkhon";
const FREE_HINTS = 3;
const GIVEUP_AFTER = 20;
export const VOCAB_SIZE = () => getLexicon().size;

/** Today's date in Asia/Ulaanbaatar as YYYY-MM-DD [LOCKED spec §2]. */
export function ubDate(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Ulaanbaatar" });
}

export function findPuzzle(date: string): ScheduleEntry | null {
  const exp = loadExport();
  return exp.schedule.find((p) => p.date === date) ?? null;
}

function ranksFor(n: number): Record<string, number> {
  return loadExport().ranks[String(n)] ?? {};
}

export function publicPlay(play: PlayState) {
  return {
    guesses: play.guesses.map((g) => ({
      word: g.word, rank: g.rank, bucket: bucketForRank(g.rank),
    })),
    hints_used: play.hints.length,
    solved: play.solved,
    gave_up: play.gaveUp,
  };
}

// ---- today -----------------------------------------------------------------

export function todayPayload(token: string | undefined, now: Date = new Date()) {
  const date = ubDate(now);
  const puzzle = findPuzzle(date);
  if (!puzzle) return { error: "Тоглоом одоо хараахан нээгээгүй байна" as const, status: 404 };
  const { token: t, play } = getOrCreatePlay(token, puzzle.n);
  const pub = publicPlay(play);
  return {
    status: 200,
    sessionToken: t,
    body: {
      slug: GAME_SLUG,
      puzzle_number: puzzle.n,
      date,
      ...pub,
      vocab_size: VOCAB_SIZE(),
    },
  };
}

// ---- guess -------------------------------------------------------------------

export interface GuessDeps {
  token: string | undefined;
  ip: string;
  word: unknown;
  now?: Date;
}

export function guessAction(deps: GuessDeps) {
  const { token, ip } = deps;
  const now = deps.now ?? new Date();

  // rate limits [LOCKED spec §7]
  if (!allowHit(`sess:${token ?? ip}`, 30, 60_000) || !allowHit(`ip:${ip}`, 300, 3_600_000)) {
    return { status: 429, body: { status: "rate_limited" } };
  }

  const date = ubDate(now);
  const puzzle = findPuzzle(date);
  if (!puzzle) return { status: 404, body: { error: "Пүзл олдсонгүй" } };

  const raw = typeof deps.word === "string" ? deps.word : "";
  if (!raw.trim()) return { status: 422, body: { status: "unknown_word" } };

  const lex = getLexicon();
  const res = lex.resolveGuess(raw);
  if (res.status === "unknown" || !res.lemma) {
    return { status: 422, body: { status: "unknown_word" } };
  }

  const { token: t, play } = getOrCreatePlay(token, puzzle.n);

  const rankMap = ranksFor(puzzle.n);
  const rank = rankMap[res.lemma];
  if (rank === undefined) {
    return { status: 422, body: { status: "unknown_word" } };
  }

  // duplicate → flash existing row, no counter increment (spec §6.2)
  const existing = play.guesses.find((g) => g.lemma === res.lemma);
  if (existing) {
    savePlay(t, puzzle.n, play);
    return {
      status: 200,
      sessionToken: t,
      body: {
        status: "duplicate",
        word: existing.word,
        rank: existing.rank,
        bucket: bucketForRank(existing.rank),
        guesses_count: play.guesses.length,
        solved: play.solved,
      },
    };
  }

  const displayWord =
    res.status === "corrected" ? res.matched! : cleanInput(raw);
  play.guesses.push({ word: displayWord, lemma: res.lemma, rank, index: play.guesses.length });

  let answerReveal: string | null = null;
  if (rank === 1 && !play.solved) {
    play.solved = true;
    play.finishedAt = now.toISOString();
    answerReveal = puzzle.answer;   // only now may the answer be sent
  }
  savePlay(t, puzzle.n, play);

  return {
    status: 200,
    sessionToken: t,
    body: {
      status: res.status === "corrected" ? "corrected" : "ok",
      correction: res.status === "corrected" ? res.message : undefined,
      word: displayWord,
      lemma: res.lemma,
      rank,
      bucket: bucketForRank(rank),
      bucket_label: bucketLabel(rank),
      fill: progressFill(rank, VOCAB_SIZE()),
      guesses_count: play.guesses.length,
      solved: play.solved,
      answer: answerReveal,
    },
  };
}

function cleanInput(raw: string): string {
  return raw.trim().normalize("NFC");
}

// ---- hints -------------------------------------------------------------------

export function hintAction(type: unknown, token: string | undefined, now: Date = new Date()) {
  const date = ubDate(now);
  const puzzle = findPuzzle(date);
  if (!puzzle) return { status: 404, body: { error: "Пүзл олдсонгүй" } };
  if (typeof type !== "string") return { status: 400, body: { error: "type шаардлагатай" } };

  const { token: t, play } = getOrCreatePlay(token, puzzle.n);
  if (play.hints.length >= FREE_HINTS) {
    return { status: 402, body: { status: "needs_sub" } };
  }

  let payload: Record<string, unknown> = {};
  if (type === "letter_count") {
    payload = { letters: puzzle.answer.length };
  } else if (type === "first_letter") {
    payload = { letter: puzzle.answer.charAt(0) };
  } else if (type === "nearby_word") {
    const guessedLemmas = new Set(play.guesses.map((g) => g.lemma));
    const prevCursor = play.hints.filter((h) => h.type === "nearby_word").length;
    const rankMap = Object.entries(ranksFor(puzzle.n))
      .filter(([lemma, r]) => r >= 10 && r <= 50 && !guessedLemmas.has(lemma) && lemma !== puzzle.answer)
      .sort((a, b) => a[1] - b[1]);
    const pick = rankMap[prevCursor % Math.max(rankMap.length, 1)];
    if (!pick) return { status: 409, body: { error: "Сэжүүр байхгүй боллоо" } };
    payload = { word: pick[0], rank: pick[1] };
  } else {
    return { status: 400, body: { error: "Үл мэдэгдэх сэжүүрийн төрөл" } };
  }

  play.hints.push({ type, payload });
  savePlay(t, puzzle.n, play);
  return { status: 200, sessionToken: t, body: { type, ...payload, hints_used: play.hints.length } };
}

// ---- give up -------------------------------------------------------------------

export function giveupAction(token: string | undefined, now: Date = new Date()) {
  const date = ubDate(now);
  const puzzle = findPuzzle(date);
  if (!puzzle) return { status: 404, body: { error: "Пүзл олдсонгүй" } };

  const { token: t, play } = getOrCreatePlay(token, puzzle.n);
  if (play.guesses.length < GIVEUP_AFTER) {
    return { status: 409, body: { status: "too_early", need: GIVEUP_AFTER - play.guesses.length } };
  }
  if (!play.gaveUp) {
    play.gaveUp = true;
    play.finishedAt = now.toISOString();
    savePlay(t, puzzle.n, play);
  }

  const top10 = Object.entries(ranksFor(puzzle.n))
    .filter(([lemma]) => lemma !== puzzle.answer)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 10)
    .map(([word, rank]) => ({ word, rank }));
  return { status: 200, sessionToken: t, body: { answer: puzzle.answer, nearest: top10 } };
}

/** exported for tests */
export const _test = { resetLimits, FREE_HINTS, GIVEUP_AFTER };
