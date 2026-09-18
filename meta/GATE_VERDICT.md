# Quality Gate Verdict — spec §3.6

**Date:** 2026-08-26
**Model:** fastText cc.mn.300 (cc.mn.300.bin, Facebook crawl vectors)
**Vocabulary:** 22,396 lemmas (mnwiki corpus)
**Reviewer:** project owner
**Reports:** data/reports/gate_fasttext.txt (top-50 neighbors per word)

## Result: 18 / 20 PASS (threshold ≥17)

| Word | Verdict |
|------|---------|
| морь, ном, эмээ, сургууль, цас, гутал, баяр, хот, найз, хоол, машин, өвөл, хайр, ажил, гэр, эмч, мод, дуу | ✅ pass |
| ус | ❌ top-20 = function words/particles (нь, ба, эх, юм, км …) |
| нар | ❌ embeds plural-particle usage ("багш нар"), not the sun sense |

## Decisions

1. fastText cc.mn.300 is the production embedding for rank precomputation.
   e5-large (~11/20) and LaBSE (~14/20) evaluated and rejected.
2. `ус` and `нар` are excluded from the answer pool via meta/blocklist.txt;
   they remain valid guess vocabulary.
3. Answers shorter than 3 letters are already excluded by config
   (ANSWER_MIN_LEN); consider raising to 4 if short-word noise recurs.

## Addendum 2026-09-18 — re-gate on playable words only

The original gate counted a word's own inflections (хүндэтгэлийн, хүндэтгэх …)
as recognisable neighbours, which flattered fastText's subword model. Re-run
with `pipeline.playable` applied (verb forms, proper nouns, inflected
leftovers and same-stem words removed) on the same 20 words:

- **fastText**: still clearly best — цас → цасан мөс мөндөр зуд; хайр → дурлал
  энэрэл сэтгэл халамж; мод → хуш сөөг царс гацуур нарс; өвөл → зун хавар
  намар хүйтэн.
- **LaBSE**: leaks Russian (города, работа, песня) and letter fragments.
- **e5-large**: mostly orthographic (цас → цаас цааз цам).
- **fastText+LaBSE rank average**: occasionally helps (гутал), usually adds noise.

Decision 1 stands. `нар` still fails (plural-particle sense) and stays
blocklisted as an answer.
