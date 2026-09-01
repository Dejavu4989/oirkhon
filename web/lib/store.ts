// Play-state store (dev: JSON file under data/web/state.json).
//
// Plays are filed under an *identity*: the account key `u:<id>` once signed in,
// otherwise the anonymous cookie token. That way progress follows an account
// across devices, and a visitor who signs up keeps the game they already began.
//
// The shape matches what a Postgres-backed store needs (spec §5 plays/guesses/
// hints), so this swaps for real tables without touching callers.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export interface GuessRecord {
  word: string;       // surface as typed
  lemma: string;
  rank: number;
  index: number;      // chronological order
}

/** A hint always reveals a real word plus its rank, so it renders like a guess. */
export interface HintRecord {
  type: "nearby_word";
  payload: { word: string; rank: number };
}

export interface PlayState {
  guesses: GuessRecord[];
  hints: HintRecord[];
  solved: boolean;
  gaveUp: boolean;
  startedAt: string;
  finishedAt: string | null;
}

type Store = Record<string, Record<string, PlayState>>;

function freshPlay(): PlayState {
  return {
    guesses: [],
    hints: [],
    solved: false,
    gaveUp: false,
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
}

function statePath(): string {
  if (process.env.OIRKHON_STATE) return process.env.OIRKHON_STATE;
  for (const p of ["../data/web/state.json", "data/web/state.json"]) {
    if (fs.existsSync(p)) return p;
  }
  return "../data/web/state.json";
}

function readStore(): Store {
  try {
    return JSON.parse(fs.readFileSync(statePath(), "utf-8"));
  } catch {
    return {};
  }
}

function writeStore(all: Store): void {
  const file = statePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(all), "utf-8");
}

export function newSessionToken(): string {
  return randomUUID();
}

/** Identity key for a signed-in account. */
export function userKey(userId: number): string {
  return `u:${userId}`;
}

export function getSession(identity: string | undefined): Record<string, PlayState> {
  if (!identity) return {};
  return readStore()[identity] ?? {};
}

export function savePlay(identity: string, puzzleNumber: number, play: PlayState): void {
  const all = readStore();
  all[identity] = all[identity] ?? {};
  all[identity][String(puzzleNumber)] = play;
  writeStore(all);
}

export function getOrCreatePlay(identity: string, puzzleNumber: number): PlayState {
  return getSession(identity)[String(puzzleNumber)] ?? freshPlay();
}

/**
 * Move an anonymous visitor's games onto their new account. Puzzles the account
 * has already played win, so signing in never overwrites real progress.
 */
export function adoptAnonPlays(anonToken: string | undefined, userId: number): void {
  if (!anonToken) return;
  const all = readStore();
  const anon = all[anonToken];
  if (!anon) return;

  const key = userKey(userId);
  const mine = all[key] ?? {};
  let changed = false;
  for (const [puzzle, play] of Object.entries(anon)) {
    if (!mine[puzzle]) {
      mine[puzzle] = play;
      changed = true;
    }
  }
  if (changed) {
    all[key] = mine;
    writeStore(all);
  }
}
