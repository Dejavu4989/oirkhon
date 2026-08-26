// Play-state store (dev: JSON file under data/web/state.json).
// Interface matches what a Postgres-backed store needs (spec §5 plays/guesses/hints).
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export interface GuessRecord {
  word: string;       // surface as typed
  lemma: string;
  rank: number;
  index: number;      // chronological order
}

export interface PlayState {
  guesses: GuessRecord[];
  hints: { type: string; payload: unknown }[];
  solved: boolean;
  gaveUp: boolean;
  startedAt: string;
  finishedAt: string | null;
}

const EMPTY_PLAY: PlayState = {
  guesses: [], hints: [], solved: false, gaveUp: false,
  startedAt: "", finishedAt: null,
};

function freshPlay(): PlayState {
  // Deep-fresh: spreading EMPTY_PLAY would share its arrays across plays.
  return {
    guesses: [],
    hints: [],
    solved: false,
    gaveUp: false,
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
}
void EMPTY_PLAY;

function statePath(): string {
  if (process.env.OIRKHON_STATE) return process.env.OIRKHON_STATE;
  for (const p of ["../data/web/state.json", "data/web/state.json"]) {
    if (fs.existsSync(p)) return p;
  }
  return "../data/web/state.json";
}

export function newSessionToken(): string {
  return randomUUID();
}

export function getSession(token: string | undefined): Record<string, PlayState> {
  if (!token) return {};
  try {
    const all = JSON.parse(fs.readFileSync(statePath(), "utf-8"));
    return all[token] ?? {};
  } catch {
    return {};
  }
}

export function savePlay(token: string, puzzleNumber: number, play: PlayState): void {
  const p = path.dirname(statePath());
  fs.mkdirSync(p, { recursive: true });
  let all: Record<string, Record<string, PlayState>> = {};
  try {
    all = JSON.parse(fs.readFileSync(statePath(), "utf-8"));
  } catch { /* first write */ }
  all[token] = all[token] ?? {};
  all[token][String(puzzleNumber)] = play;
  fs.writeFileSync(statePath(), JSON.stringify(all), "utf-8");
}

export function getOrCreatePlay(token: string | undefined,
                                puzzleNumber: number): { token: string; play: PlayState } {
  const t = token ?? newSessionToken();
  const plays = getSession(t);
  const play = plays[String(puzzleNumber)] ?? freshPlay();
  return { token: t, play };
}
