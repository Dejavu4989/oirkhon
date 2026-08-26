import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  findPuzzle, giveupAction, guessAction, hintAction, todayPayload, ubDate,
} from "../actions";
import { setExport, type ExportShape } from "../lexicon";
import { resetLimits } from "../ratelimit";

const NOW = new Date("2026-09-01T12:00:00+08:00");   // UB noon on puzzle day

const FILLERS = Array.from({ length: 19 }, (_, i) => `дүр${i + 1}`);

const FIXTURE: ExportShape = {
  schedule: [{ n: 1, date: "2026-09-01", answer: "морь", difficulty: "medium" }],
  lemmas: [
    ["морь", 654], ["нохой", 500], ["ном", 900], ["хот", 800], ["гэр", 700],
    ...FILLERS.map((w, i) => [w, 400 - i] as [string, number]),
  ],
  forms: { номонд: "ном", моригоо: "морь" },
  ranks: {
    "1": {
      морь: 1, нохой: 2, ном: 9, хот: 15, гэр: 300,
      ...Object.fromEntries(FILLERS.map((w, i) => [w, 3 + i])),
    },
  },
};

let stateFile: string;

beforeEach(() => {
  setExport(JSON.parse(JSON.stringify(FIXTURE)));
  resetLimits();
  stateFile = path.join(tmpdir(), `oirkhon-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  process.env.OIRKHON_STATE = stateFile;
});

afterEach(() => {
  try { fs.unlinkSync(stateFile); } catch { /* ok */ }
  delete process.env.OIRKHON_STATE;
});

describe("ubDate", () => {
  it("rolls at 00:00 Ulaanbaatar [LOCKED]", () => {
    expect(ubDate(new Date("2026-09-01T15:59:00-07:00"))).toBe("2026-09-02"); // 06:59 UB
    expect(ubDate(new Date("2026-09-01T13:00:00Z"))).toBe("2026-09-01");      // 21:00 UB
  });
});

describe("todayPayload", () => {
  it("hides the answer before solve [LOCKED]", () => {
    const res = todayPayload(undefined, NOW);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('"морь"');
    expect(res.body!.puzzle_number).toBe(1);
    expect(res.body!.guesses).toEqual([]);
  });

  it("404 before epoch", () => {
    const res = todayPayload(undefined, new Date("2026-08-01T12:00:00+08:00"));
    expect(res.status).toBe(404);
  });
});

describe("guessAction", () => {
  it("ok guess returns rank + bucket, no answer", () => {
    const r = guessAction({ token: undefined, ip: "1.2.3.4", word: "нохой", now: NOW });
    expect(r.status).toBe(200);
    expect(r.body.rank).toBe(2);
    expect(r.body.bucket).toBe("hot");
    expect(r.body.solved).toBe(false);
    expect(JSON.stringify(r.body)).not.toContain('"морь"');
  });

  it("inflected form of the answer counts as solved and reveals answer", () => {
    const r = guessAction({ token: undefined, ip: "1", word: "моригоо", now: NOW });
    expect(r.status).toBe(200);
    expect(r.body.solved).toBe(true);
    expect(r.body.answer).toBe("морь");
  });

  it("duplicate does not increment counter", () => {
    const a = guessAction({ token: "t1", ip: "1", word: "ном", now: NOW });
    expect(a.sessionToken).toBe("t1");
    const b = guessAction({ token: a.sessionToken, ip: "1", word: "номонд", now: NOW });
    expect(b.body.status).toBe("duplicate");
    expect(b.body.guesses_count).toBe(1);
  });

  it("unknown word -> 422", () => {
    const r = guessAction({ token: undefined, ip: "1", word: "зззззз", now: NOW });
    expect(r.status).toBe(422);
    expect(r.body.status).toBe("unknown_word");
  });

  it("corrected typo flags status corrected", () => {
    const r = guessAction({ token: undefined, ip: "1", word: "нохои", now: NOW });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("corrected");
    expect(r.body.correction).toContain("гэж ойлголоо");
    expect(r.body.lemma).toBe("нохой");
  });

  it("rate limit: 31st guess in a minute -> 429", () => {
    let last;
    for (let i = 0; i < 31; i++) {
      last = guessAction({ token: "rl", ip: "5", word: i === 0 ? "ном" : `ном${i}`, now: NOW });
    }
    expect(last!.status).toBe(429);
  });

  it("guess history survives refresh via store", () => {
    const first = guessAction({ token: undefined, ip: "1", word: "ном", now: NOW });
    const today = todayPayload(first.sessionToken, NOW);
    expect(today.body!.guesses).toHaveLength(1);
    expect(today.body!.guesses[0].word).toBe("ном");
  });
});

describe("hintAction", () => {
  it("letter_count reveals length only", () => {
    const r = hintAction("letter_count", undefined, NOW);
    expect(r.status).toBe(200);
    expect(r.body.letters).toBe(4);
    expect(JSON.stringify(r.body)).not.toContain("морь\"");
  });

  it("first_letter reveals one letter", () => {
    const r = hintAction("first_letter", undefined, NOW);
    expect(r.body.letter).toBe("м");
  });

  it("nearby_word walks ranks 10..50, skipping guessed", () => {
    const g = guessAction({ token: "hn", ip: "1", word: "ном", now: NOW }); // rank 9
    const r1 = hintAction("nearby_word", g.sessionToken, NOW);
    expect(r1.status).toBe(200);
    expect(r1.body.rank).toBeGreaterThanOrEqual(10);
    expect(r1.body.rank).toBeLessThanOrEqual(50);
  });

  it("402 after three free hints", () => {
    let token: string | undefined = "h3";
    for (const t of ["letter_count", "first_letter", "nearby_word"]) {
      const r = hintAction(t, token, NOW);
      expect(r.status).toBe(200);
      token = r.sessionToken ?? token;
    }
    const fourth = hintAction("letter_count", token, NOW);
    expect(fourth.status).toBe(402);
    expect(fourth.body.status).toBe("needs_sub");
  });
});

describe("giveupAction", () => {
  it("409 before 20 guesses", () => {
    const r = giveupAction(undefined, NOW);
    expect(r.status).toBe(409);
  });

  it("after 20 guesses reveals answer + nearest list", () => {
    let token: string | undefined = "gu";
    for (let i = 0; i < 20; i++) {
      const word = i === 19 ? "моригоо" : FILLERS[i];   // 19 fillers then solve? no — keep unsolved
      const r = guessAction({ token, ip: "1", word, now: NOW });
      token = r.sessionToken!;
    }
    const r = giveupAction(token, NOW);
    expect(r.status).toBe(200);
    expect(r.body.answer).toBe("морь");
    expect(r.body.nearest.length).toBeGreaterThanOrEqual(3);
    expect(r.body.nearest[0].rank).toBe(2);            // нохой is rank 2
  });
});

describe("findPuzzle", () => {
  it("finds by exact date", () => {
    expect(findPuzzle("2026-09-01")?.n).toBe(1);
    expect(findPuzzle("2027-01-01")).toBeNull();
  });
});
