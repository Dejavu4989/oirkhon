import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  activityPayload, archiveList, boardPayload, findPuzzle, giveupAction,
  guessAction, hintAction, HINTS_FREE, HINTS_SUBSCRIBER, ubDate, type Ctx,
} from "../actions";
import type { Viewer } from "../auth";
import { setExport, type ExportShape } from "../lexicon";
import { resetLimits } from "../ratelimit";
import { pendingUnknown } from "../unknown";

const NOW = new Date("2026-09-01T12:00:00+08:00");   // UB noon on puzzle #2

const FILLERS = Array.from({ length: 19 }, (_, i) => `дүр${i + 1}`);

// Two published days, so #1 is the archive and #2 is today.
const FIXTURE: ExportShape = {
  schedule: [
    { n: 1, date: "2026-08-31", answer: "ном", difficulty: "easy" },
    { n: 2, date: "2026-09-01", answer: "морь", difficulty: "medium" },
  ],
  lemmas: [
    ["морь", 654], ["нохой", 500], ["ном", 900], ["хот", 800], ["гэр", 700],
    ...FILLERS.map((w, i) => [w, 400 - i] as [string, number]),
  ],
  forms: { номонд: "ном", моригоо: "морь" },
  ranks: {
    "1": { ном: 1, хот: 2, морь: 5, гэр: 50, нохой: 100 },
    "2": {
      морь: 1, нохой: 2, ном: 9, хот: 15, гэр: 300,
      ...Object.fromEntries(FILLERS.map((w, i) => [w, 3 + i])),
    },
  },
};

const FREE: Viewer = {
  id: 1, email: "free@x.mn", displayName: "Free", avatarUrl: null,
  isSubscribed: false, subscriptionExpiresAt: null,
};
const SUB: Viewer = { ...FREE, id: 2, email: "sub@x.mn", isSubscribed: true };

const anon = (token?: string): Ctx => ({ viewer: null, token, ip: "1", now: NOW });
const as = (viewer: Viewer): Ctx => ({ viewer, token: "anon", ip: "1", now: NOW });

let stateFile: string;
let unknownFile: string;

function tmpFile(tag: string): string {
  return path.join(tmpdir(),
    `oirkhon-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

beforeEach(() => {
  setExport(JSON.parse(JSON.stringify(FIXTURE)));
  resetLimits();
  stateFile = tmpFile("state");
  unknownFile = tmpFile("unknown");
  process.env.OIRKHON_STATE = stateFile;
  process.env.OIRKHON_UNKNOWN = unknownFile;
});

afterEach(() => {
  for (const f of [stateFile, unknownFile]) {
    try { fs.unlinkSync(f); } catch { /* ok */ }
  }
  delete process.env.OIRKHON_STATE;
  delete process.env.OIRKHON_UNKNOWN;
});

describe("ubDate", () => {
  it("rolls at 00:00 Ulaanbaatar [LOCKED]", () => {
    expect(ubDate(new Date("2026-09-01T15:59:00-07:00"))).toBe("2026-09-02"); // 06:59 UB
    expect(ubDate(new Date("2026-09-01T13:00:00Z"))).toBe("2026-09-01");      // 21:00 UB
  });
});

describe("boardPayload", () => {
  it("hides the answer before solve [LOCKED]", () => {
    const res = boardPayload(anon());
    expect(res.status).toBe(200);
    expect(res.body.puzzle_number).toBe(2);
    expect(res.body.answer).toBeNull();
    expect(JSON.stringify(res.body)).not.toContain('"морь"');
  });

  it("404 before the first puzzle", () => {
    expect(boardPayload({ viewer: null, token: undefined, now: new Date("2026-08-01T12:00:00+08:00") })
      .status).toBe(404);
  });

  it("sends the answer back once solved, so a reload keeps the result", () => {
    const g = guessAction(anon("s1"), "моригоо");
    expect(g.body.solved).toBe(true);
    const after = boardPayload(anon("s1"));
    expect(after.body.answer).toBe("морь");
    expect(after.body.nearest).toBeNull();
  });

  it("sends answer and nearest after a give-up", () => {
    for (const w of FILLERS.concat(["гэр"])) guessAction(anon("s2"), w);
    giveupAction(anon("s2"));
    const after = boardPayload(anon("s2"));
    expect(after.body.answer).toBe("морь");
    expect(after.body.nearest!.length).toBeGreaterThan(0);
  });

  it("reports the hint allowance for the viewer", () => {
    expect(boardPayload(anon()).body.hints_allowed).toBe(HINTS_FREE);
    expect(boardPayload(as(SUB)).body.hints_allowed).toBe(HINTS_SUBSCRIBER);
  });
});

describe("guessAction", () => {
  it("ok guess returns rank + bucket, no answer", () => {
    const r = guessAction(anon(), "нохой");
    expect(r.status).toBe(200);
    expect(r.body.rank).toBe(2);
    expect(r.body.bucket).toBe("hot");
    expect(JSON.stringify(r.body)).not.toContain('"морь"');
  });

  it("inflected form of the answer solves and reveals", () => {
    const r = guessAction(anon(), "моригоо");
    expect(r.body.solved).toBe(true);
    expect(r.body.answer).toBe("морь");
  });

  it("duplicate does not increment counter", () => {
    guessAction(anon("d1"), "ном");
    const b = guessAction(anon("d1"), "номонд");
    expect(b.body.status).toBe("duplicate");
    expect(b.body.guesses_count).toBe(1);
  });

  it("unknown word -> 422", () => {
    const r = guessAction(anon(), "зззззз");
    expect(r.status).toBe(422);
    expect(r.body.status).toBe("unknown_word");
  });

  it("corrected typo flags status corrected", () => {
    const r = guessAction(anon(), "нохои");
    expect(r.body.status).toBe("corrected");
    expect(r.body.lemma).toBe("нохой");
  });

  it("rate limit: 31st guess in a minute -> 429", () => {
    let last;
    for (let i = 0; i < 31; i++) last = guessAction(anon("rl"), i === 0 ? "ном" : `ном${i}`);
    expect(last!.status).toBe(429);
  });

  it("history survives a refresh", () => {
    guessAction(anon("h"), "ном");
    expect(boardPayload(anon("h")).body.guesses).toHaveLength(1);
  });
});

describe("accounts", () => {
  it("a signed-in player's board is separate from the anonymous one", () => {
    guessAction(anon("shared"), "ном");
    // Same anon cookie, but signed in: the account has its own board.
    expect(boardPayload(as(FREE)).body.guesses).toHaveLength(0);
    expect(boardPayload(anon("shared")).body.guesses).toHaveLength(1);
  });

  it("two accounts do not see each other's guesses", () => {
    guessAction(as(FREE), "ном");
    expect(boardPayload(as(FREE)).body.guesses).toHaveLength(1);
    expect(boardPayload(as(SUB)).body.guesses).toHaveLength(0);
  });
});

describe("archive [#6]", () => {
  it("today's puzzle is free for everyone", () => {
    expect(boardPayload(anon(), 2).status).toBe(200);
  });

  it("a past puzzle is locked without a subscription", () => {
    const r = boardPayload(anon(), 1);
    expect(r.status).toBe(402);
    expect(r.body.status).toBe("needs_sub");
  });

  it("a subscriber can open a past puzzle", () => {
    const r = boardPayload(as(SUB), 1);
    expect(r.status).toBe(200);
    expect(r.body.puzzle_number).toBe(1);
    expect(r.body.is_archive).toBe(true);
    expect(r.body.answer).toBeNull();          // still hidden until solved
  });

  it("a subscriber can actually play a past puzzle", () => {
    const g = guessAction(as(SUB), "хот", 1);   // rank 2 in puzzle #1
    expect(g.status).toBe(200);
    expect(g.body.rank).toBe(2);
    const solve = guessAction(as(SUB), "ном", 1);
    expect(solve.body.solved).toBe(true);
    expect(solve.body.answer).toBe("ном");
  });

  it("guessing a past puzzle without a subscription is refused", () => {
    const g = guessAction(as(FREE), "хот", 1);
    expect(g.status).toBe(402);
  });

  it("future puzzles are never reachable", () => {
    expect(boardPayload(as(SUB), 99).status).toBe(404);
  });

  it("listing marks lock state and progress", () => {
    const free = archiveList(as(FREE));
    expect(free).toHaveLength(1);
    expect(free[0].puzzle_number).toBe(1);
    expect(free[0].locked).toBe(true);

    guessAction(as(SUB), "хот", 1);
    const sub = archiveList(as(SUB));
    expect(sub[0].locked).toBe(false);
    expect(sub[0].played).toBe(true);
  });
});

describe("unknown-word queue", () => {
  it("records a rejected guess for admin review", () => {
    guessAction(anon(), "зззззз");
    guessAction(anon(), "зззззз");
    const q = pendingUnknown();
    expect(q).toHaveLength(1);
    expect(q[0].count).toBe(2);
  });

  it("does not record accepted guesses", () => {
    guessAction(anon(), "ном");
    expect(pendingUnknown()).toHaveLength(0);
  });

  it("ignores junk that is not a Mongolian word", () => {
    for (const junk of ["", "  ", "a", "<script>", "12345", "x".repeat(80)]) {
      guessAction(anon(), junk);
    }
    expect(pendingUnknown()).toHaveLength(0);
  });
});

describe("hintAction", () => {
  it("409 needs_guess before the player has guessed anything", () => {
    const r = hintAction(anon("h0"));
    expect(r.status).toBe(409);
    expect(r.body.status).toBe("needs_guess");
  });

  it("reveals a word strictly closer than the player's best guess", () => {
    guessAction(anon("h1"), "гэр");            // rank 300
    const r = hintAction(anon("h1"));
    expect(r.status).toBe(200);
    expect(r.body.rank).toBeLessThan(300);
  });

  it("never reveals the answer itself [LOCKED]", () => {
    guessAction(anon("h2"), "дүр1");           // rank 3 — only rank 2 is closer
    const r = hintAction(anon("h2"));
    expect(r.body.rank).toBe(2);
    expect(JSON.stringify(r.body)).not.toContain("морь");
  });

  it("each hint halves the distance and never repeats a word", () => {
    guessAction(anon("h3"), "гэр");
    const seen = new Set<string>(["гэр"]);
    let prev = 300;
    for (let i = 0; i < 3; i++) {
      const r = hintAction(anon("h3"));
      expect(r.status).toBe(200);
      expect(r.body.rank).toBeLessThan(prev);
      expect(seen.has(r.body.word!)).toBe(false);
      seen.add(r.body.word!);
      prev = r.body.rank!;
    }
  });

  it("409 no_closer when only the answer is nearer", () => {
    guessAction(anon("h4"), "нохой");          // rank 2
    expect(hintAction(anon("h4")).body.status).toBe("no_closer");
  });

  it("does not re-reveal a word the player already guessed", () => {
    guessAction(anon("h5"), "гэр");
    guessAction(anon("h5"), "дүр19");
    expect(hintAction(anon("h5")).body.word).not.toBe("дүр19");
  });

  it("hints come back with the board so a refresh keeps them", () => {
    guessAction(anon("hp"), "гэр");
    const r = hintAction(anon("hp"));
    const today = boardPayload(anon("hp"));
    expect(today.body.hints).toHaveLength(1);
    expect(today.body.hints![0]).toEqual({
      type: "nearby_word", payload: { word: r.body.word, rank: r.body.rank },
    });
  });

  it("402 after three free hints", () => {
    guessAction(anon("h6"), "гэр");
    for (let i = 0; i < HINTS_FREE; i++) expect(hintAction(anon("h6")).status).toBe(200);
    const extra = hintAction(anon("h6"));
    expect(extra.status).toBe(402);
    expect(extra.body.status).toBe("needs_sub");
  });

  it("a subscriber gets more than the free allowance [#8]", () => {
    guessAction(as(SUB), "гэр");
    let granted = 0;
    // The rate limiter caps bursts, so reset between hints — we are testing the
    // allowance, not the burst limit.
    for (let i = 0; i < HINTS_SUBSCRIBER + 2; i++) {
      resetLimits();
      const r = hintAction(as(SUB));
      if (r.status === 200) granted++;
      else break;
    }
    expect(granted).toBeGreaterThan(HINTS_FREE);
  });
});

describe("giveupAction", () => {
  it("409 before 20 guesses", () => {
    expect(giveupAction(anon("g0")).status).toBe(409);
  });

  it("after 20 guesses reveals answer + nearest list", () => {
    for (const w of FILLERS.concat(["гэр"])) guessAction(anon("g1"), w);
    const r = giveupAction(anon("g1"));
    expect(r.status).toBe(200);
    expect(r.body.answer).toBe("морь");
    expect(r.body.nearest!.length).toBeGreaterThanOrEqual(3);
  });
});

describe("endpoint rate limits", () => {
  it("hints are limited per session", () => {
    let last;
    for (let i = 0; i < 11; i++) last = hintAction(anon("hrl"));
    expect(last!.status).toBe(429);
  });

  it("giveup is limited per session", () => {
    let last;
    for (let i = 0; i < 11; i++) last = giveupAction(anon("grl"));
    expect(last!.status).toBe(429);
  });

  it("hints do not consume the guess budget", () => {
    for (let i = 0; i < 10; i++) hintAction(anon("mix"));
    expect(guessAction(anon("mix"), "ном").status).toBe(200);
  });
});

describe("activity [#5]", () => {
  it("ends on today and carries the month of each day", () => {
    const days = activityPayload(anon(), 7);
    expect(days).toHaveLength(7);
    const last = days[days.length - 1];
    expect(last.isToday).toBe(true);
    expect(last.date).toBe("2026-09-01");
    expect(last.day).toBe(1);
    expect(last.month).toBe(9);
    expect(days[0].date).toBe("2026-08-26");
    expect(days[0].month).toBe(8);
    expect(days.filter((d) => d.isToday)).toHaveLength(1);
  });

  it("marks a day played once the player has guessed", () => {
    guessAction(anon("a1"), "ном");
    const days = activityPayload(anon("a1"), 7);
    expect(days[days.length - 1].played).toBe(true);
    expect(days.slice(0, -1).every((d) => !d.played)).toBe(true);
  });
});

describe("findPuzzle", () => {
  it("finds by exact date", () => {
    expect(findPuzzle("2026-09-01")?.n).toBe(2);
    expect(findPuzzle("2027-01-01")).toBeNull();
  });
});
