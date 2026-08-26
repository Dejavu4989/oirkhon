import { beforeEach, describe, expect, it } from "vitest";
import { Lexicon, type ExportShape } from "../lexicon";

const BASE: ExportShape = {
  schedule: [{ n: 1, date: "2026-09-01", answer: "морь", difficulty: "medium" }],
  lemmas: [
    ["морь", 654], ["нохой", 500], ["ном", 900], ["хот", 800], ["гэр", 700],
    ["ноход", 30],
  ],
  forms: { нохойн: "нохой", нохойд: "нохой" },
  ranks: { "1": { морь: 1, нохой: 2, ноход: 40, ном: 9, хот: 15, гэр: 300 } },
};

let fixture: ExportShape;

beforeEach(() => {
  fixture = JSON.parse(JSON.stringify(BASE));
});

describe("Lexicon.resolveGuess", () => {
  it("exact lemma", () => {
    const r = new Lexicon(fixture).resolveGuess("морь");
    expect(r.status).toBe("exact");
    expect(r.lemma).toBe("морь");
  });

  it("acceptance §12: case, whitespace, inflections agree", () => {
    const lex = new Lexicon(fixture);
    for (const raw of ["НОХОЙ", " нохой ", "нохойн", "нохойд"]) {
      expect(lex.resolveGuess(raw).lemma).toBe("нохой");
    }
  });

  it("typo corrected with visible notice", () => {
    const r = new Lexicon(fixture).resolveGuess("нохои");
    expect(r.status).toBe("corrected");
    expect(r.lemma).toBe("нохой");
    expect(r.message).toBe("«нохои» → «нохой» гэж ойлголоо.");
  });

  it("latin lookalike maps silently [LOCKED map]", () => {
    // 'xot' -> 'хот' via the lookalike table; normalize() includes mapping
    const r = new Lexicon(fixture).resolveGuess("xot");
    expect(r.status).toBe("exact");
    expect(r.lemma).toBe("хот");
  });

  it("ambiguous fuzzy stays unknown", () => {
    fixture.forms["номоо"] = "ном";   // номо is distance 1 from both ном and номоо
    const r = new Lexicon(fixture).resolveGuess("номо");
    expect(r.status).toBe("unknown");
  });

  it("gibberish unknown", () => {
    expect(new Lexicon(fixture).resolveGuess("ззззз").status).toBe("unknown");
  });
});
