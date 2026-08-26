# Ойрхон — Phase 0 Pipeline

Python package that builds everything the game needs from raw Mongolian text:
corpus → vocabulary → morphology → embeddings → ranks. The core
(morphology/tolerance/vocab/forms) is **stdlib-only**; heavy deps are optional.

## Module map

| Module | Purpose |
|---|---|
| `alphabet.py` | Cyrillic sets, vowel harmony (`а о у ы` back / `э ө ү` front / `и е` neutral), Latin-lookalike map, confusable pairs |
| `textnorm.py` | NFC, script filtering (drop Latin/CJK-heavy docs), wiki markup stripping |
| `morphology/` | Suffix inventory + rule lemmatizer: dictionary-first, then bounded BFS stripping with harmony pruning, stem repairs (өдр→өдөр, мор→морь), verb reconstruction (яв+ах=явах) |
| `tolerance.py` | Guess resolution: clean → lookalikes → exact → unambiguous Levenshtein-1 (о↔ө у↔ү е↔э и↔й ц↔ч cost 0.5). Correction message: `«x» → «y» гэж ойлголоо.` |
| `corpus/wiki.py` | Streams mnwiki dump (any export version), 29k docs / 909k sentences from current dump |
| `corpus/cc100.py` | Streams CC-100 mn (run for volume; wiki alone is not enough for embeddings) |
| `corpus/news.py` | robots.txt-respecting crawler skeleton; configure sites after legal review |
| `vocab.py` | Top-40k forms → lemma reduction by frequency margin (`ноход→нохой` merges; `багана↛бага`) |
| `forms.py` | Unambiguous form→lemma dictionary (+ curated `meta/manual_merges.tsv` overrides) |
| `candidates.py` | Answer candidates 3–9 letters, difficulty bands, Mondays=easy — **review only, never auto-approved** |
| `embeddings/` | fastText cc.mn.300 / e5-large / LaBSE + concat & rank-average ensemble |
| `ranks.py` | Full ranked list per puzzle → Postgres `puzzle_ranks` + Redis `ranks:{id}` |
| `inspect.py` | Quality-gate CLI (below) |
| `gameutil.py` | Rank buckets, log progress bar, share-text builder |

## Curated lists (committed under `/meta`)

- `no_merge.txt` — forms that must never merge during reduction (багана, эмээ).
- `manual_merges.tsv` — form⇥lemma overrides for cases statistics get wrong
  (мориноор→морь: poetic морин outnumbers морь on Wikipedia).
- `blocklist.txt` — excluded from answer candidates.

These are admin-maintained; extend them as the unknown-word queue surfaces issues.

## Build order

```powershell
$env:PYTHONUTF8 = '1'

# 1. corpus (wiki done; add CC-100 for embedding-grade volume)
python -m pipeline.corpus.wiki --file data/raw/mnwiki-latest-pages-articles.xml.bz2
python -m pipeline.corpus.cc100 --max-lines 20000000        # ~1GB xz stream

# 2. vocabulary + forms   (current results: 39,965 forms -> 22,396 lemmas,
#                          16,449 word_forms mappings)
python -m pipeline.vocab
python -m pipeline.forms
python -m pipeline.candidates

# 3. embeddings (pip install -r requirements.txt first)
python -m pipeline.embeddings.fasttext_model --bin cc.mn.300.bin --out data/vectors/fasttext_mn.npz
python -m pipeline.embeddings.st_model --model intfloat/multilingual-e5-large --prompt query --out data/vectors/e5_large.npz
python -m pipeline.embeddings.st_model --model sentence-transformers/LaBSE --out data/vectors/labse.npz

# 4. QUALITY GATE — review top-50 neighbors for the 20 spec words with a
#    Mongolian speaker; pass = 17/20 words with recognizable top-20.
python -m pipeline.inspect морь --vectors data/vectors/*.npz --top 50
#    words: морь ном ус эмээ сургууль цас гутал баяр хот найз хоол машин
#           өвөл хайр ажил нар гэр эмч мод дуу
#    All 20 are confirmed present in the current vocabulary.

# 5. DB + ranks (after schema apply and puzzle scheduling)
python -m pipeline.db apply-schema
python -m pipeline.db upsert-lemmas data/vocab/lemmas.tsv
python -m pipeline.db upsert-word-forms data/vocab/word_forms.jsonl
python -m pipeline.ranks --vectors <best>.npz --answer морь --puzzle-id 1 \
    --dsn $env:PIPELINE_DATABASE_URL --redis $env:PIPELINE_REDIS_URL
```

## Environment variables

- `PIPELINE_DATABASE_URL` — Postgres DSN for db.py / ranks.py
- `PIPELINE_REDIS_URL` — Redis URL for rank caching
- `PIPELINE_DATA_DIR` — default `<repo>/data` (gitignored build outputs)
- `PIPELINE_CURATED_DIR` — default `<repo>/meta` (versioned lists)

## Design notes / known limitations

- Identity-wins at lookup: a surface that is itself a valid word is read as
  itself (`хүнд` stays хүнд, not хүн). Intended for game fairness.
- `-х` is never stripped from infinitives; verbs map *to* -х via reconstruction.
- Possessive suffixes require a 3+ letter remainder (protects эмээ).
- POS tags are heuristic (-х ⇒ verb); refine against a dictionary later or in
  the admin panel.
- Wiki-only vocab is 22.4k lemmas; CC-100 + news will lift it toward 25–30k.
- морин/морь-class poetic variants are decided by curated manual merges.
