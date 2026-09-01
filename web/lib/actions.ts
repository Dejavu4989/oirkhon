// Game actions — shared by API routes and tests. The answer string must never
// appear in any client-facing payload before solve/give-up [LOCKED spec §2].
import type { Viewer } from "./auth";
import { bucketForRank, bucketLabel, progressFill } from "./game";
import { getLexicon, loadExport, type ScheduleEntry } from "./lexicon";
import { allowHit, resetLimits } from "./ratelimit";
import {
  getOrCreatePlay, getSession, newSessionToken, savePlay, userKey, type PlayState,
} from "./store";
import { recordUnknown } from "./unknown";

export const GAME_SLUG = "oirkhon";
const GIVEUP_AFTER = 20;
export const VOCAB_SIZE = () => getLexicon().size;

/** Free players get three hints a day; subscribers get more [#8]. */
export const HINTS_FREE = 3;
export const HINTS_SUBSCRIBER = 10;
export function hintAllowance(viewer: Viewer | null): number {
  return viewer?.isSubscribed ? HINTS_SUBSCRIBER : HINTS_FREE;
}

// Rate limits [LOCKED spec §7]. Each endpoint gets its own per-session bucket
// (spending hints must not eat the guess budget) over one shared per-IP budget.
const GUESS_PER_MIN = 30;
const HINT_PER_MIN = 10;
const GIVEUP_PER_MIN = 10;
const IP_PER_HOUR = 300;

/** Who is asking, and as whom. */
export interface Ctx {
  viewer: Viewer | null;
  token: string | undefined;   // anonymous play cookie
  ip?: string;
  now?: Date;
}

interface Resolved {
  identity: string;   // account key when signed in, else the anon token
  token: string;      // anon token to (re)issue
  now: Date;
  ip: string;
}

function resolve(ctx: Ctx): Resolved {
  const token = ctx.token ?? newSessionToken();
  return {
    token,
    identity: ctx.viewer ? userKey(ctx.viewer.id) : token,
    now: ctx.now ?? new Date(),
    ip: ctx.ip ?? "local",
  };
}

function rateLimited(endpoint: string, perMin: number, identity: string, ip: string): boolean {
  return !allowHit(`sess:${identity}:${endpoint}`, perMin, 60_000)
      || !allowHit(`ip:${ip}`, IP_PER_HOUR, 3_600_000);
}

/** Today's date in Asia/Ulaanbaatar as YYYY-MM-DD [LOCKED spec §2]. */
export function ubDate(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Ulaanbaatar" });
}

export function findPuzzle(date: string): ScheduleEntry | null {
  return loadExport().schedule.find((p) => p.date === date) ?? null;
}

export function findPuzzleByNumber(n: number): ScheduleEntry | null {
  return loadExport().schedule.find((p) => p.n === n) ?? null;
}

function ranksFor(n: number): Record<string, number> {
  return loadExport().ranks[String(n)] ?? {};
}

/** Closest words to the answer, excluding the answer itself. */
function nearestWords(puzzleNumber: number, answer: string, limit = 10) {
  return Object.entries(ranksFor(puzzleNumber))
    .filter(([lemma]) => lemma !== answer)
    .sort((a, b) => a[1] - b[1])
    .slice(0, limit)
    .map(([word, rank]) => ({ word, rank }));
}

// ---- which puzzle -------------------------------------------------------------

type PuzzlePick =
  | { ok: true; puzzle: ScheduleEntry; isArchive: boolean }
  | { ok: false; status: number; body: Record<string, unknown> };

/**
 * Today's puzzle is free for everyone. Earlier days are the subscriber archive
 * [#6]; future days are not published and must not leak.
 */
export function pickPuzzle(n: number | undefined, viewer: Viewer | null,
                           now: Date): PuzzlePick {
  const today = findPuzzle(ubDate(now));
  if (!today) {
    return { ok: false, status: 404, body: { error: "Тоглоом одоо хараахан нээгээгүй байна" } };
  }
  if (n === undefined || n === today.n) {
    return { ok: true, puzzle: today, isArchive: false };
  }
  if (!Number.isInteger(n) || n < 1 || n > today.n) {
    return { ok: false, status: 404, body: { error: "Пүзл олдсонгүй" } };
  }
  const puzzle = findPuzzleByNumber(n);
  if (!puzzle) return { ok: false, status: 404, body: { error: "Пүзл олдсонгүй" } };
  if (!viewer?.isSubscribed) {
    return { ok: false, status: 402, body: { status: "needs_sub", puzzle_number: n } };
  }
  return { ok: true, puzzle, isArchive: true };
}

// ---- board --------------------------------------------------------------------

export function publicPlay(play: PlayState) {
  return {
    guesses: play.guesses.map((g) => ({
      word: g.word, rank: g.rank, bucket: bucketForRank(g.rank),
    })),
    hints: play.hints.map((h) => ({ type: h.type, payload: h.payload })),
    hints_used: play.hints.length,
    solved: play.solved,
    gave_up: play.gaveUp,
  };
}

export interface BoardBody {
  slug?: string;
  puzzle_number?: number;
  date?: string;
  is_archive?: boolean;
  guesses?: { word: string; rank: number; bucket: string }[];
  hints?: { type: string; payload: { word: string; rank: number } }[];
  hints_used?: number;
  hints_allowed?: number;
  solved?: boolean;
  gave_up?: boolean;
  vocab_size?: number;
  answer?: string | null;
  nearest?: { word: string; rank: number }[] | null;
  status?: string;
  error?: string;
}

export function boardPayload(ctx: Ctx, n?: number):
                             { status: number; sessionToken: string; body: BoardBody } {
  const { identity, token, now } = resolve(ctx);
  const pick = pickPuzzle(n, ctx.viewer, now);
  if (!pick.ok) return { status: pick.status, sessionToken: token, body: pick.body };

  const { puzzle, isArchive } = pick;
  const play = getOrCreatePlay(identity, puzzle.n);
  const finished = play.solved || play.gaveUp;
  return {
    status: 200,
    sessionToken: token,
    body: {
      slug: GAME_SLUG,
      puzzle_number: puzzle.n,
      date: puzzle.date,
      is_archive: isArchive,
      ...publicPlay(play),
      hints_allowed: hintAllowance(ctx.viewer),
      vocab_size: VOCAB_SIZE(),
      // Only ever after solve or give-up [LOCKED spec §2].
      answer: finished ? puzzle.answer : null,
      nearest: play.gaveUp ? nearestWords(puzzle.n, puzzle.answer) : null,
    },
  };
}

/** Back-compat alias for the daily board. */
export function todayPayload(token: string | undefined, now: Date = new Date()) {
  return boardPayload({ viewer: null, token, now });
}

// ---- activity -----------------------------------------------------------------

export interface ActivityDay {
  date: string;      // YYYY-MM-DD in Asia/Ulaanbaatar
  day: number;       // day-of-month, shown in the pill
  month: number;
  played: boolean;
  isToday: boolean;
}

/** Last `days` days ending today, flagged with whether this player played. */
export function activityPayload(ctx: Ctx, days = 7): ActivityDay[] {
  const { identity, now } = resolve(ctx);
  const today = ubDate(now);
  const plays = getSession(identity);
  const out: ActivityDay[] = [];
  for (let back = days - 1; back >= 0; back--) {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - back);
    const date = d.toISOString().slice(0, 10);
    const puzzle = findPuzzle(date);
    const play = puzzle ? plays[String(puzzle.n)] : undefined;
    out.push({
      date,
      day: d.getUTCDate(),
      month: d.getUTCMonth() + 1,
      played: Boolean(play && (play.guesses.length > 0 || play.hints.length > 0)),
      isToday: date === today,
    });
  }
  return out;
}

// ---- archive listing ----------------------------------------------------------

export interface ArchiveEntry {
  puzzle_number: number;
  date: string;
  played: boolean;
  solved: boolean;
  locked: boolean;
}

/** Past puzzles, newest first. Locked for everyone but subscribers [#6]. */
export function archiveList(ctx: Ctx, limit = 60): ArchiveEntry[] {
  const { identity, now } = resolve(ctx);
  const today = findPuzzle(ubDate(now));
  if (!today) return [];
  const plays = getSession(identity);
  const subscribed = Boolean(ctx.viewer?.isSubscribed);

  return loadExport().schedule
    .filter((p) => p.n < today.n)
    .sort((a, b) => b.n - a.n)
    .slice(0, limit)
    .map((p) => {
      const play = plays[String(p.n)];
      return {
        puzzle_number: p.n,
        date: p.date,
        played: Boolean(play && play.guesses.length > 0),
        solved: Boolean(play?.solved),
        locked: !subscribed,
      };
    });
}

// ---- guess --------------------------------------------------------------------

export interface GuessBody {
  status?: string;
  correction?: string | null;
  word?: string;
  lemma?: string;
  rank?: number;
  bucket?: string;
  bucket_label?: string;
  fill?: number;
  guesses_count?: number;
  solved?: boolean;
  answer?: string | null;
  puzzle_number?: number;
  error?: string;
}

export function guessAction(ctx: Ctx, word: unknown, n?: number):
                            { status: number; sessionToken: string; body: GuessBody } {
  const { identity, token, now, ip } = resolve(ctx);

  if (rateLimited("guess", GUESS_PER_MIN, identity, ip)) {
    return { status: 429, sessionToken: token, body: { status: "rate_limited" } };
  }

  const pick = pickPuzzle(n, ctx.viewer, now);
  if (!pick.ok) return { status: pick.status, sessionToken: token, body: pick.body };
  const puzzle = pick.puzzle;

  const raw = typeof word === "string" ? word : "";
  if (!raw.trim()) return { status: 422, sessionToken: token, body: { status: "unknown_word" } };

  const res = getLexicon().resolveGuess(raw);
  if (res.status === "unknown" || !res.lemma) {
    recordUnknown(raw, now);            // admin review queue (spec §5)
    return { status: 422, sessionToken: token, body: { status: "unknown_word" } };
  }

  const play = getOrCreatePlay(identity, puzzle.n);
  const rank = ranksFor(puzzle.n)[res.lemma];
  if (rank === undefined) {
    recordUnknown(res.lemma, now);      // in the lexicon but missing from vectors
    return { status: 422, sessionToken: token, body: { status: "unknown_word" } };
  }

  // duplicate → flash existing row, no counter increment (spec §6.2)
  const existing = play.guesses.find((g) => g.lemma === res.lemma);
  if (existing) {
    return {
      status: 200,
      sessionToken: token,
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

  const displayWord = res.status === "corrected" ? res.matched! : raw.trim().normalize("NFC");
  play.guesses.push({ word: displayWord, lemma: res.lemma, rank, index: play.guesses.length });

  let answerReveal: string | null = null;
  if (rank === 1 && !play.solved) {
    play.solved = true;
    play.finishedAt = now.toISOString();
    answerReveal = puzzle.answer;   // only now may the answer be sent
  }
  savePlay(identity, puzzle.n, play);

  return {
    status: 200,
    sessionToken: token,
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

// ---- hints --------------------------------------------------------------------

/**
 * A hint reveals a real word that ranks closer to the answer than anything the
 * player has seen so far. It never leaks letters or the answer itself — the
 * point is to move the player forward from where they already are.
 */
export interface HintBody {
  type?: "nearby_word";
  word?: string;
  rank?: number;
  hints_used?: number;
  hints_allowed?: number;
  status?: "rate_limited" | "needs_sub" | "needs_guess" | "no_closer" | "finished";
  error?: string;
}

/** Ranks the player has already been shown: their guesses plus earlier hints. */
function knownRanks(play: PlayState): number[] {
  return [...play.guesses.map((g) => g.rank), ...play.hints.map((h) => h.payload.rank)];
}

/** Words already on the board, which a hint must not repeat. */
function revealedWords(play: PlayState): Set<string> {
  return new Set([...play.guesses.map((g) => g.lemma), ...play.hints.map((h) => h.payload.word)]);
}

export function hintAction(ctx: Ctx, n?: number):
                           { status: number; sessionToken?: string; body: HintBody } {
  const { identity, token, now, ip } = resolve(ctx);
  if (rateLimited("hint", HINT_PER_MIN, identity, ip)) {
    return { status: 429, sessionToken: token, body: { status: "rate_limited" } };
  }
  const pick = pickPuzzle(n, ctx.viewer, now);
  if (!pick.ok) {
    return { status: pick.status, sessionToken: token, body: pick.body as HintBody };
  }
  const puzzle = pick.puzzle;

  const play = getOrCreatePlay(identity, puzzle.n);
  const allowed = hintAllowance(ctx.viewer);
  if (play.solved || play.gaveUp) {
    return { status: 409, sessionToken: token, body: { status: "finished" } };
  }
  if (play.hints.length >= allowed) {
    return {
      status: 402,
      sessionToken: token,
      body: { status: "needs_sub", hints_used: play.hints.length, hints_allowed: allowed },
    };
  }

  // "Closer" is meaningless until the player has something to be closer than.
  const known = knownRanks(play);
  if (!known.length) {
    return { status: 409, sessionToken: token, body: { status: "needs_guess" } };
  }
  const best = Math.min(...known);

  // Halve the remaining distance, so each hint is a real step without ever
  // landing on rank 1 — the answer must stay server-side [LOCKED spec §2].
  const target = Math.max(2, Math.floor(best / 2));
  const seen = revealedWords(play);
  let pickWord: { word: string; rank: number } | null = null;
  for (const [lemma, rank] of Object.entries(ranksFor(puzzle.n))) {
    if (rank < 2 || rank > target) continue;      // rank 1 is the answer
    if (seen.has(lemma)) continue;
    if (!pickWord || rank > pickWord.rank) pickWord = { word: lemma, rank };
  }
  if (!pickWord) {
    return { status: 409, sessionToken: token, body: { status: "no_closer" } };
  }

  play.hints.push({ type: "nearby_word", payload: pickWord });
  savePlay(identity, puzzle.n, play);
  return {
    status: 200,
    sessionToken: token,
    body: {
      type: "nearby_word",
      word: pickWord.word,
      rank: pickWord.rank,
      hints_used: play.hints.length,
      hints_allowed: allowed,
    },
  };
}

// ---- give up -------------------------------------------------------------------

export interface GiveupBody {
  answer?: string;
  nearest?: { word: string; rank: number }[];
  need?: number;
  status?: "rate_limited" | "too_early" | "needs_sub";
  error?: string;
}

export function giveupAction(ctx: Ctx, n?: number):
                             { status: number; sessionToken?: string; body: GiveupBody } {
  const { identity, token, now, ip } = resolve(ctx);
  if (rateLimited("giveup", GIVEUP_PER_MIN, identity, ip)) {
    return { status: 429, sessionToken: token, body: { status: "rate_limited" } };
  }
  const pick = pickPuzzle(n, ctx.viewer, now);
  if (!pick.ok) {
    return { status: pick.status, sessionToken: token, body: pick.body as GiveupBody };
  }
  const puzzle = pick.puzzle;

  const play = getOrCreatePlay(identity, puzzle.n);
  if (play.guesses.length < GIVEUP_AFTER) {
    return {
      status: 409,
      sessionToken: token,
      body: { status: "too_early", need: GIVEUP_AFTER - play.guesses.length },
    };
  }
  if (!play.gaveUp && !play.solved) {
    play.gaveUp = true;
    play.finishedAt = now.toISOString();
    savePlay(identity, puzzle.n, play);
  }

  return {
    status: 200,
    sessionToken: token,
    body: { answer: puzzle.answer, nearest: nearestWords(puzzle.n, puzzle.answer) },
  };
}

/** exported for tests */
export const _test = { resetLimits, GIVEUP_AFTER };
