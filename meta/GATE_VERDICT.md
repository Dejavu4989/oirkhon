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
