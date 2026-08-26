# Ойрхон — Mongolian daily word-game platform

Daily semantic-proximity game («Ойрхон»): one secret Mongolian word per day,
guesses return server-side ranks (1 = the answer). Built for multiple games on
one platform (Ойрхон → Үсэглэл → Хаана вэ?).

**Status: Phase 0 COMPLETE — quality gate PASSED 18/20 on 2026-08-26
(fastText cc.mn.300; `ус` and `нар` rejected, see meta/GATE_VERDICT.md).
Web app build is next (spec §11 steps 3–9).**

## Repository layout

```
pipeline/               Phase 0 Python package (stdlib-only core)
  alphabet.py           Cyrillic sets, vowel harmony, Latin lookalikes
  textnorm.py           NFC, script filtering, wiki markup stripping
  morphology/           suffix inventory + rule-based lemmatizer
  tolerance.py          guess resolution: normalize → exact → fuzzy-1
  corpus/               wiki / cc100 / news collectors
  vocab.py              token counting, top-forms, lemma reduction
  forms.py              word_forms dictionary builder (dictionary-first)
  candidates.py         answer-candidate generation (admin reviews; never auto)
  embeddings/           fastText cc.mn.300, e5-large, LaBSE, ensemble
  ranks.py              rank precomputation -> Postgres puzzle_ranks + Redis
  inspect.py            quality-gate CLI: python -m pipeline.inspect <word>
  gameutil.py           rank buckets, log progress bar, share-text math
  db.py                 Postgres access for pipeline outputs
  tests/                unittest suite (150+ hand-checked morphology pairs)
db/migrations/001_init.sql   full platform schema (spec §5)
```

## Quickstart (Phase 0)

```powershell
# 1. Unit tests — no dependencies needed
$env:PYTHONUTF8 = '1'
python -m unittest discover -s pipeline/tests -t . -v

# 2. Corpus (run one or more; see pipeline/README.md for details)
python -m pipeline.corpus.wiki --max-docs 20000        # streams mn-wiki dump
python -m pipeline.corpus.cc100 --max-lines 5000000    # streams CC-100 mn

# 3. Vocabulary + form dictionary
python -m pipeline.vocab
python -m pipeline.forms
python -m pipeline.candidates          # answer candidates -> admin review

# 4. Embeddings + quality gate (needs numpy/gensim/sentence-transformers)
pip install -r pipeline/requirements.txt
python -m pipeline.embeddings.fasttext_model --bin cc.mn.300.bin --out data/vectors/fasttext_mn.npz
python -m pipeline.embeddings.st_model --model intfloat/multilingual-e5-large --prompt query --out data/vectors/e5_large.npz
python -m pipeline.embeddings.st_model --model sentence-transformers/LaBSE --out data/vectors/labse.npz

# 5. Inspect nearest neighbors — THE quality gate tool (spec §3.6)
python -m pipeline.inspect морь --vectors data/vectors/fasttext_mn.npz data/vectors/e5_large.npz data/vectors/labse.npz
```

## Locked decisions (do not change without asking)

- Timezone `Asia/Ulaanbaatar`; daily reset 00:00; puzzle # = days since epoch + 1.
- The answer never leaves the server before solve/give-up.
- Ranks precomputed offline; request-time lookup only (p95 < 80ms).
- Multi-game platform from day one (shared accounts/subscriptions/streaks).
- Mongolian-first copy everywhere.

## Roadmap (spec §11)

1. `/pipeline` — corpus, vocabulary, morphology + tests, embeddings, inspect CLI ✅ (code)
2. Quality gate §3.6 — **pending: needs real embeddings + your review with a Mongolian speaker**
3. Schema + migrations + rank job + 30 days of approved answers (schema SQL ready)
4. API routes with tests
5. Game UI, anonymous play, share text
6. Auth + streaks + archive paywall
7. QPay integration
8. Admin panel
9. SEO
