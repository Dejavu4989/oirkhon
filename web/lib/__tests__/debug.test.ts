import { expect, it } from "vitest";
import path from "node:path";
import { tmpdir } from "node:os";
import { guessAction } from "../actions";
import { setExport, type ExportShape } from "../lexicon";

const NOW = new Date("2026-09-01T12:00:00+08:00");
const FIXTURE: ExportShape = {
  schedule: [{ n: 1, date: "2026-09-01", answer: "морь", difficulty: "medium" }],
  lemmas: [["морь", 654], ["нохой", 500], ["ном", 900], ["хот", 800], ["гэр", 700]],
  forms: {},
  ranks: { "1": { морь: 1, нохой: 2, ном: 9, хот: 15, гэр: 300 } },
};

it("debug flows", () => {
  const exp = JSON.parse(JSON.stringify(FIXTURE));
  exp.forms["нойтон"] = "нойтон";
  setExport(exp);
  process.env.OIRKHON_STATE = path.join(tmpdir(), `dbg-${Date.now()}.json`);

  const r1 = guessAction({ token: undefined, ip: "9", word: "нохои", now: NOW });
  console.log("R1:", JSON.stringify(r1, null, 0));

  const r2 = guessAction({ token: "x1", ip: "9", word: "нохой", now: NOW });
  const r3 = guessAction({ token: r2.sessionToken, ip: "9", word: "нохойн", now: NOW });
  console.log("R3:", JSON.stringify(r3, null, 0));
  expect(true).toBe(true);
});
