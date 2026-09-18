# AGENTS.md

## Commands

```powershell
# Run the full test suite (stdlib-only, no install needed)
$env:PYTHONUTF8 = '1'
python -m unittest discover -s pipeline/tests -t . -v

# Run a single module's tests
python -m unittest pipeline.tests.test_morphology -v
```

No linter configured yet; keep the core pipeline stdlib-only so tests run
anywhere without pip installs. Heavy deps (numpy/gensim/sentence-transformers/
psycopg2/redis) are optional imports guarded with friendly errors.

## Conventions

- Product language is Mongolian Cyrillic first; do not introduce an English
  translation layer into user-facing strings.
- All LOCKED spec decisions live in README.md — ask before deviating.
- Data artifacts under `data/` are build outputs; never commit them.
- The answer word must never appear in any client-facing payload before
  solve/give-up — this applies to future API code too.

## Current phase

Phase 1 (`/web`). The §3.6 quality gate passed on 2026-08-26 (18/20, fastText
cc.mn.300 — see meta/GATE_VERDICT.md), so Next.js/API/UI work is open.

The app currently runs off `data/web/export.json.gz` (built by
`python -m pipeline.export_web`) with file-backed play state and an in-process
rate limiter. Postgres/Redis are the next swap: `db/migrations/001_init.sql`
is written but not yet wired, and `web/lib/store.ts` / `ratelimit.ts` /
`unknown.ts` are shaped to match the `plays` / `guesses` / `hints` /
`unknown_words` tables.

```powershell
cd web
npx vitest run       # 78 tests (9 need DATABASE_URL, else skipped)
npm run dev          # reads ../data/web/export.json.gz
```

## Accounts

Postgres (`DATABASE_URL`) backs accounts, sign-in sessions and subscriptions —
see `db/README.md`. Without it the daily game still runs anonymously and the
sign-in UI reports that accounts are disabled; keep that graceful path working.

- Passwords: scrypt via `node:crypto`, parameters stored with each hash.
- Sessions: random 256-bit cookie, only its SHA-256 is stored.
- Google sign-in is optional (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`) and the
  button hides itself when unset.
- Subscribed = `is_subscribed` AND the term has not lapsed. Subscribers get the
  archive and `HINTS_SUBSCRIBER` hints instead of `HINTS_FREE`.
- Play state is filed under an *identity*: `u:<id>` when signed in, else the
  anonymous cookie. Signing in adopts the anonymous game already in progress.

## Word quality: the playable filter

The corpus vocabulary (22k lemmas) is ~60% noise for game purposes — proper
nouns, verb forms, inflected forms that survived lemma reduction, function
words. `pipeline/playable.py` is the single place that decides what is fit to
play with, and everything downstream uses it:

- **playable** words (~9k nouns) form the *rank space*: every guess is ranked
  among them, hints are drawn only from them, the give-up list shows only them.
  A non-playable word (a verb, a name) is still a valid guess and gets the rank
  it would have had among playable words — it just never gets offered.
- **answer-eligible** is stricter: playable AND common AND native-looking AND
  attested in ≥2 inflected forms AND a terminal citation form AND not generic.

Rules that could hurt real words check the vocabulary first (`багтана` is
dropped only because `багтах` exists; `хана` stays because `хах` does not).
The `pos` column in lemmas.tsv is literally "ends in -х" — never read it.

Admin loop for word problems:

```powershell
python -m pipeline.playable --audit           # counts + samples per reason
python -m pipeline.playable --why WORD ...    # explain individual words
python -m pipeline.inspect WORD --vectors data/vectors/fasttext_mn.npz   # neighbours as the game sees them
```

Curated overrides under `meta/`: `noun_exceptions.txt` (always playable —
homonyms like түүх, эмэгтэй, хаан), `blocklist.txt` (never an answer),
`answer_exclusions.tsv` (answer⇥word: a wrong-sense neighbour, pushed to the
bottom for that puzzle). After changing any of them, re-run the schedule swap
and the export.

A hint never shares the answer's stem (`sharesStem` in `web/lib/actions.ts`,
comparing after folding ь→и so морь/морин is caught).

## Game rules that live in code

- A **hint** reveals a real word ranked closer to the answer than anything the
  player has seen, halving the remaining distance (`floor(best / 2)`). It never
  reveals rank 1 and never leaks letters. 3 free per day; it refuses before the
  player's first guess. See `hintAction` in `web/lib/actions.ts`.
- `today` returns the answer only once the play is solved or given up, so the
  result panel and share text survive a page reload.
- Rejected guesses go to the `unknown_words` queue (`web/lib/unknown.ts`).
- Today's puzzle is free for everyone. Past puzzles are the subscriber archive;
  future puzzles must never be reachable (`pickPuzzle` in `web/lib/actions.ts`).
- Once a game is finished the answer is pinned to the top of the board, whether
  it was solved or given up.

## UI

Single dark theme; tokens in `web/app/globals.css`, mapped to Tailwind names in
`tailwind.config.ts`. The board's bar widths come from `barWidth()` in
`web/lib/game.ts` (presentation only) — `progressFill()` stays the shared value
mirrored in `pipeline/gameutil.py`.

After changing the schedule, blocklist or curated lists, re-export before the
app sees it. **Never change a puzzle that has already been played** — a
subscriber's archive board stores ranks against the original answer. Pass
today's puzzle number as `--from`:

```powershell
python -m pipeline.candidates                 # rebuild the candidate pool
python -m pipeline.schedule --swap --from 24  # replace ineligible drafts after #24 only
python -m pipeline.schedule --from 24 --days 90   # or: keep #1–#24, redraft/extend the rest
python -m pipeline.schedule --audit           # flag drafts today's rules would reject
python -m pipeline.export_web                 # rebuild data/web/export.json.gz (format 2)
```

Export format 2 stores one rank per lemma as an array aligned with `lemmas`
(3.5 MB for 67 puzzles) plus the `playable` list; `web/lib/lexicon.ts` reads
both formats.
